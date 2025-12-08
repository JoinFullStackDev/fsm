import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
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
  feature_type?: string;
}

interface UserRow {
  id: string;
  organization_id: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
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
 * GET /api/global/admin/ai-usage
 * Get AI usage statistics grouped by organization (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get all AI usage logs
    const { data: aiLogs, error: aiLogsError } = await adminClient
      .from('activity_logs')
      .select('id, user_id, action_type, created_at, metadata')
      .in('action_type', AI_ACTION_TYPES)
      .order('created_at', { ascending: false })
      .limit(10000); // Increased limit to get comprehensive stats

    if (aiLogsError) {
      logger.error('Error loading AI usage:', aiLogsError);
      return internalError('Failed to load AI usage logs', { error: aiLogsError.message });
    }

    // Get unique user IDs from logs
    const userIds = [...new Set((aiLogs as ActivityLogRow[] || []).map((log) => log.user_id).filter((id): id is string => Boolean(id)))];

    // Get user and organization info for all users
    let usersMap = new Map<string, { organization_id: string | null; organization_name: string | null }>();
    let orgsMap = new Map<string, string>(); // organization_id -> organization_name
    
    if (userIds.length > 0) {
      // Get users with their organization_ids
      const { data: users, error: usersError } = await adminClient
        .from('users')
        .select('id, organization_id')
        .in('id', userIds);

      if (!usersError && users) {
        // Get unique organization IDs
        const orgIds = [...new Set((users as UserRow[]).map((u) => u.organization_id).filter((id): id is string => Boolean(id)))];
        
        // Get organization names
        if (orgIds.length > 0) {
          const { data: orgs, error: orgsError } = await adminClient
            .from('organizations')
            .select('id, name')
            .in('id', orgIds);

          if (!orgsError && orgs) {
            (orgs as OrganizationRow[]).forEach((org) => {
              orgsMap.set(org.id, org.name);
            });
          }
        }

        // Build users map
        (users as UserRow[]).forEach((user) => {
          usersMap.set(user.id, {
            organization_id: user.organization_id,
            organization_name: user.organization_id ? (orgsMap.get(user.organization_id) || null) : null,
          });
        });
      }
    }

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Process logs and group by organization with enhanced metrics
    const orgStatsMap = new Map<string, {
      organization_id: string;
      organization_name: string;
      total_requests: number;
      requests_this_month: number;
      requests_today: number;
      total_characters: number; // prompt + response
      total_tokens: number;
      total_cost: number;
      total_response_time_ms: number;
      error_count: number;
      by_feature: Map<string, {
        count: number;
        total_characters: number;
        total_tokens: number;
        total_cost: number;
        total_response_time_ms: number;
        error_count: number;
      }>;
    }>();

    let totalRequests = 0;
    let requestsThisMonth = 0;
    let requestsToday = 0;
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

    ((aiLogs as ActivityLogRow[]) || []).forEach((log) => {
      totalRequests++;
      
      const logDate = new Date(log.created_at);
      if (logDate >= startOfMonth) requestsThisMonth++;
      if (logDate >= startOfToday) requestsToday++;

      // Extract metadata
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

      // Update totals
      totalCharacters += totalChars;
      totalTokens += totalTokenCount;
      totalCost += cost;
      totalResponseTime += responseTime;
      if (hasError) totalErrors++;

      // Track by feature
      const feature = metadata.feature_type || log.action_type || 'unknown';
      if (!featureMap.has(feature)) {
        featureMap.set(feature, {
          count: 0,
          total_characters: 0,
          total_tokens: 0,
          total_cost: 0,
          total_response_time_ms: 0,
          error_count: 0,
        });
      }
      const featureStats = featureMap.get(feature)!;
      featureStats.count++;
      featureStats.total_characters += totalChars;
      featureStats.total_tokens += totalTokenCount;
      featureStats.total_cost += cost;
      featureStats.total_response_time_ms += responseTime;
      if (hasError) featureStats.error_count++;

      // Group by organization
      const userInfo = log.user_id ? usersMap.get(log.user_id) : null;
      const orgId = userInfo?.organization_id;
      const orgName = userInfo?.organization_name || 'Unknown Organization';

      if (orgId) {
        if (!orgStatsMap.has(orgId)) {
          orgStatsMap.set(orgId, {
            organization_id: orgId,
            organization_name: orgName,
            total_requests: 0,
            requests_this_month: 0,
            requests_today: 0,
            total_characters: 0,
            total_tokens: 0,
            total_cost: 0,
            total_response_time_ms: 0,
            error_count: 0,
            by_feature: new Map(),
          });
        }

        const orgStats = orgStatsMap.get(orgId)!;
        orgStats.total_requests++;
        if (logDate >= startOfMonth) orgStats.requests_this_month++;
        if (logDate >= startOfToday) orgStats.requests_today++;
        orgStats.total_characters += totalChars;
        orgStats.total_tokens += totalTokenCount;
        orgStats.total_cost += cost;
        orgStats.total_response_time_ms += responseTime;
        if (hasError) orgStats.error_count++;

        // Track by feature within organization
        if (!orgStats.by_feature.has(feature)) {
          orgStats.by_feature.set(feature, {
            count: 0,
            total_characters: 0,
            total_tokens: 0,
            total_cost: 0,
            total_response_time_ms: 0,
            error_count: 0,
          });
        }
        const orgFeatureStats = orgStats.by_feature.get(feature)!;
        orgFeatureStats.count++;
        orgFeatureStats.total_characters += totalChars;
        orgFeatureStats.total_tokens += totalTokenCount;
        orgFeatureStats.total_cost += cost;
        orgFeatureStats.total_response_time_ms += responseTime;
        if (hasError) orgFeatureStats.error_count++;
      }
    });

    // Convert maps to arrays with enhanced metrics
    const organizations = Array.from(orgStatsMap.values())
      .map(org => ({
        organization_id: org.organization_id,
        organization_name: org.organization_name,
        total_requests: org.total_requests,
        requests_this_month: org.requests_this_month,
        requests_today: org.requests_today,
        total_characters: org.total_characters,
        total_tokens: org.total_tokens,
        total_cost: org.total_cost,
        average_response_time_ms: org.total_requests > 0 
          ? Math.round(org.total_response_time_ms / org.total_requests) 
          : 0,
        error_count: org.error_count,
        error_rate: org.total_requests > 0 
          ? (org.error_count / org.total_requests) * 100 
          : 0,
        by_feature: Array.from(org.by_feature.entries())
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
          .sort((a, b) => b.requests - a.requests),
      }))
      .sort((a, b) => b.total_requests - a.total_requests); // Sort by total requests descending

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

    // Calculate averages
    const averagePerOrg = organizations.length > 0
      ? Math.round(totalRequests / organizations.length)
      : 0;
    const averageResponseTime = totalRequests > 0
      ? Math.round(totalResponseTime / totalRequests)
      : 0;
    const errorRate = totalRequests > 0
      ? (totalErrors / totalRequests) * 100
      : 0;

    return NextResponse.json({
      totalRequests,
      totalCost: totalCost,
      totalCharacters,
      totalTokens,
      requestsThisMonth,
      requestsToday,
      averagePerOrg,
      averageResponseTime,
      errorRate,
      totalErrors,
      organizations,
      byFeature,
      topOrganizations: organizations.slice(0, 10), // Top 10 organizations
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/ai-usage:', error);
    return internalError('Failed to load AI usage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

