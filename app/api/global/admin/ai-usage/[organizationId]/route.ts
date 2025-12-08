import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Types for AI usage data
interface ActivityLogRow {
  id: string;
  user_id: string | null;
  action_type: string;
  created_at: string;
  metadata: AIUsageMetadata | null;
}

interface AIUsageMetadata {
  full_prompt_length?: number;
  prompt_length?: number;
  response_length?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  response_time_ms?: number;
  error?: string;
  error_type?: string;
  feature_type?: string;
  model?: string;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string;
}

export const dynamic = 'force-dynamic';

/**
 * AI action types that should be tracked
 */
const AI_ACTION_TYPES = [
  'ai_used',
  'ai_generate',
  'project_analyze',
  'tasks_generated',
  'ai_task_generation',
];

/**
 * GET /api/global/admin/ai-usage/[organizationId]
 * Get detailed AI usage statistics for a specific organization (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const feature = searchParams.get('feature');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get organization
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('id', params.organizationId)
      .single();

    if (orgError || !org) {
      return badRequest('Organization not found');
    }

    // Get users in this organization
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select('id')
      .eq('organization_id', params.organizationId);

    if (usersError) {
      logger.error('Error loading users:', usersError);
      return internalError('Failed to load users', { error: usersError.message });
    }

    const userIds = (users || []).map((u: { id: string }) => u.id);

    if (userIds.length === 0) {
      return NextResponse.json({
        organization: {
          id: org.id,
          name: org.name,
        },
        aggregated: {
          totalRequests: 0,
          totalCost: 0,
          totalCharacters: 0,
          totalTokens: 0,
          averageResponseTime: 0,
          errorRate: 0,
          errorCount: 0,
        },
        byFeature: [],
        requests: [],
        pagination: {
          total: 0,
          limit,
          offset,
        },
      });
    }

    // Build query for activity logs
    let query = adminClient
      .from('activity_logs')
      .select('id, user_id, action_type, created_at, metadata')
      .in('action_type', AI_ACTION_TYPES)
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    // Apply date filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Get total count for pagination
    const { count, error: countError } = await adminClient
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .in('action_type', AI_ACTION_TYPES)
      .in('user_id', userIds);

    if (countError) {
      logger.error('Error counting logs:', countError);
    }

    // Get paginated logs
    const { data: aiLogs, error: aiLogsError } = await query
      .range(offset, offset + limit - 1);

    if (aiLogsError) {
      logger.error('Error loading AI usage:', aiLogsError);
      return internalError('Failed to load AI usage logs', { error: aiLogsError.message });
    }

    // Get user names for display
    const { data: userDetails } = await adminClient
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    const userMap = new Map<string, { name: string; email: string }>();
    ((userDetails as UserRow[]) || []).forEach((u) => {
      userMap.set(u.id, { name: u.name || u.email, email: u.email });
    });

    // Process logs for aggregated stats
    let totalRequests = 0;
    let totalCharacters = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    const featureMap = new Map<string, {
      count: number;
      total_characters: number;
      total_tokens: number;
      total_cost: number;
      total_response_time_ms: number;
      error_count: number;
    }>();

    // Filter by feature if specified
    const typedLogs = (aiLogs as ActivityLogRow[]) || [];
    const filteredLogs = feature
      ? typedLogs.filter((log) => {
          const metadata = log.metadata || {};
          const logFeature = metadata.feature_type || log.action_type;
          return logFeature === feature;
        })
      : typedLogs;

    filteredLogs.forEach((log) => {
      totalRequests++;

      const metadata = log.metadata || {};
      const fullPromptLength = metadata.full_prompt_length || metadata.prompt_length || 0;
      const responseLength = metadata.response_length || 0;
      const totalChars = fullPromptLength + responseLength;
      const inputTokens = metadata.input_tokens || 0;
      const outputTokens = metadata.output_tokens || 0;
      const totalTokenCount = metadata.total_tokens || (inputTokens + outputTokens);
      const cost = metadata.estimated_cost || 0;
      const responseTime = metadata.response_time_ms || 0;
      const hasError = !!metadata.error;

      totalCharacters += totalChars;
      totalTokens += totalTokenCount;
      totalCost += cost;
      totalResponseTime += responseTime;
      if (hasError) totalErrors++;

      // Track by feature
      const logFeature = metadata.feature_type || log.action_type || 'unknown';
      if (!featureMap.has(logFeature)) {
        featureMap.set(logFeature, {
          count: 0,
          total_characters: 0,
          total_tokens: 0,
          total_cost: 0,
          total_response_time_ms: 0,
          error_count: 0,
        });
      }
      const featureStats = featureMap.get(logFeature)!;
      featureStats.count++;
      featureStats.total_characters += totalChars;
      featureStats.total_tokens += totalTokenCount;
      featureStats.total_cost += cost;
      featureStats.total_response_time_ms += responseTime;
      if (hasError) featureStats.error_count++;
    });

    // Build individual requests list
    const requests = filteredLogs.map((log) => {
      const metadata = log.metadata || {};
      const user = log.user_id ? userMap.get(log.user_id) : null;
      const fullPromptLength = metadata.full_prompt_length || metadata.prompt_length || 0;
      const responseLength = metadata.response_length || 0;
      const inputTokens = metadata.input_tokens || 0;
      const outputTokens = metadata.output_tokens || 0;
      const totalTokenCount = metadata.total_tokens || (inputTokens + outputTokens);
      const cost = metadata.estimated_cost || 0;
      const responseTime = metadata.response_time_ms || 0;
      const hasError = !!metadata.error;

      return {
        id: log.id,
        timestamp: log.created_at,
        user: user ? {
          id: log.user_id,
          name: user.name,
          email: user.email,
        } : null,
        feature: metadata.feature_type || log.action_type || 'unknown',
        prompt_length: fullPromptLength,
        response_length: responseLength,
        total_characters: fullPromptLength + responseLength,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokenCount,
        cost,
        response_time_ms: responseTime,
        model: metadata.model || 'gemini-2.5-flash',
        error: metadata.error || null,
        error_type: metadata.error_type || null,
        metadata: metadata, // Include full metadata for detailed view
      };
    });

    const byFeature = Array.from(featureMap.entries())
      .map(([feature, stats]) => ({
        feature,
        requests: stats.count,
        total_characters: stats.total_characters,
        total_tokens: stats.total_tokens,
        total_cost: stats.total_cost,
        average_response_time_ms: stats.count > 0 
          ? Math.round(stats.total_response_time_ms / stats.count) 
          : 0,
        error_count: stats.error_count,
        error_rate: stats.count > 0 
          ? (stats.error_count / stats.count) * 100 
          : 0,
      }))
      .sort((a, b) => b.requests - a.requests);

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
      },
      aggregated: {
        totalRequests,
        totalCost: totalCost,
        totalCharacters,
        totalTokens,
        averageResponseTime: totalRequests > 0 
          ? Math.round(totalResponseTime / totalRequests) 
          : 0,
        errorRate: totalRequests > 0 
          ? (totalErrors / totalRequests) * 100 
          : 0,
        errorCount: totalErrors,
      },
      byFeature,
      requests,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/ai-usage/[organizationId]:', error);
    return internalError('Failed to load organization AI usage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

