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
import type { CreateSuccessMetricInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/metrics
 * List all success metrics for a workspace
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

    // Get search params
    const { searchParams } = new URL(request.url);
    const metricType = searchParams.get('metric_type');
    const status = searchParams.get('status');
    const healthStatus = searchParams.get('health_status');

    // Build query
    let query = adminClient
      .from('workspace_success_metrics')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (metricType) {
      query = query.eq('metric_type', metricType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (healthStatus) {
      query = query.eq('health_status', healthStatus);
    }

    const { data: metrics, error } = await query;

    if (error) {
      logger.error('[Metrics API] Failed to fetch metrics:', error);
      return internalError('Failed to fetch metrics');
    }

    return NextResponse.json(metrics || []);
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/metrics
 * Create new success metric
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

    const body = await request.json() as CreateSuccessMetricInput;

    // Validate required fields
    if (!body.metric_name || !body.metric_type) {
      return badRequest('Metric name and type are required');
    }

    // Create metric
    const { data: metric, error } = await adminClient
      .from('workspace_success_metrics')
      .insert({
        workspace_id: workspace.id,
        metric_name: body.metric_name,
        metric_type: body.metric_type,
        description: body.description || null,
        target_value: body.target_value || null,
        current_value: body.current_value || null,
        unit: body.unit || null,
        measurement_frequency: body.measurement_frequency || null,
        data_source: body.data_source || null,
        linked_clarity_spec_id: body.linked_clarity_spec_id || null,
        linked_epic_draft_id: body.linked_epic_draft_id || null,
        health_status: body.health_status || null,
        created_by: userRecord?.id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('[Metrics API] Failed to create metric:', error);
      return internalError('Failed to create metric');
    }

    logger.info('[Metrics API] Metric created:', { metricId: metric.id });
    return NextResponse.json(metric, { status: 201 });
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

