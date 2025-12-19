import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { 
  unauthorized, 
  notFound, 
  badRequest, 
  forbidden, 
  internalError 
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateUserInsightInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/discovery/insights
 * List all user insights
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    const adminClient = createAdminSupabaseClient();

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const insightType = searchParams.get('insight_type');
    const tag = searchParams.get('tag');

    // Build query
    let query = adminClient
      .from('workspace_user_insights')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('insight_date', { ascending: false });

    if (insightType) {
      query = query.eq('insight_type', insightType);
    }

    const { data: insights, error } = await query;

    if (error) {
      logger.error('[Discovery API] Failed to fetch insights:', error);
      return internalError('Failed to fetch insights');
    }

    // Filter by tag if specified (JSONB contains)
    let filteredInsights = insights || [];
    if (tag) {
      filteredInsights = filteredInsights.filter((insight: any) => 
        (insight.tags || []).includes(tag)
      );
    }

    return NextResponse.json(filteredInsights);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/discovery/insights
 * Create new user insight
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    // Get user record
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    const adminClient = createAdminSupabaseClient();

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    const body = await request.json() as CreateUserInsightInput;

    // Validate required fields
    if (!body.title || !body.insight_type) {
      return badRequest('Title and insight type are required');
    }

    // Create insight
    const { data: insight, error } = await adminClient
      .from('workspace_user_insights')
      .insert({
        workspace_id: workspace.id,
        insight_type: body.insight_type,
        title: body.title,
        summary: body.summary || null,
        full_content: body.full_content || null,
        source: body.source || null,
        pain_points: body.pain_points || [],
        feature_requests: body.feature_requests || [],
        quotes: body.quotes || [],
        tags: body.tags || [],
        user_segment: body.user_segment || null,
        user_role: body.user_role || null,
        validated_assumptions: body.validated_assumptions || [],
        invalidated_assumptions: body.invalidated_assumptions || [],
        linked_clarity_spec_id: body.linked_clarity_spec_id || null,
        insight_date: body.insight_date || new Date().toISOString().split('T')[0],
        created_by: userRecord?.id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('[Discovery API] Failed to create insight:', error);
      return internalError('Failed to create insight');
    }

    logger.info('[Discovery API] Insight created:', { insightId: insight.id });
    return NextResponse.json(insight, { status: 201 });
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

