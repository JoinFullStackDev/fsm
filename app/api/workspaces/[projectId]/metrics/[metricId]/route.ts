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
import type { UpdateSuccessMetricInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/metrics/[metricId]
 * Get a single metric
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; metricId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, metricId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(metricId)) {
      return badRequest('Invalid project or metric ID');
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

    // Get metric
    const { data: metric, error } = await adminClient
      .from('workspace_success_metrics')
      .select('*')
      .eq('id', metricId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error || !metric) {
      return notFound('Metric not found');
    }

    return NextResponse.json(metric);
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * PATCH /api/workspaces/[projectId]/metrics/[metricId]
 * Update a metric
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; metricId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, metricId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(metricId)) {
      return badRequest('Invalid project or metric ID');
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

    // Verify metric exists
    const { data: existingMetric } = await adminClient
      .from('workspace_success_metrics')
      .select('id')
      .eq('id', metricId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!existingMetric) {
      return notFound('Metric not found');
    }

    const body = await request.json() as UpdateSuccessMetricInput;

    // Update metric
    const { data: metric, error } = await adminClient
      .from('workspace_success_metrics')
      .update({
        ...(body.metric_name !== undefined && { metric_name: body.metric_name }),
        ...(body.metric_type !== undefined && { metric_type: body.metric_type }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.target_value !== undefined && { target_value: body.target_value }),
        ...(body.current_value !== undefined && { current_value: body.current_value }),
        ...(body.unit !== undefined && { unit: body.unit }),
        ...(body.measurement_frequency !== undefined && { measurement_frequency: body.measurement_frequency }),
        ...(body.data_source !== undefined && { data_source: body.data_source }),
        ...(body.linked_clarity_spec_id !== undefined && { linked_clarity_spec_id: body.linked_clarity_spec_id }),
        ...(body.linked_epic_draft_id !== undefined && { linked_epic_draft_id: body.linked_epic_draft_id }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.health_status !== undefined && { health_status: body.health_status }),
      })
      .eq('id', metricId)
      .select()
      .single();

    if (error) {
      logger.error('[Metrics API] Failed to update metric:', error);
      return internalError('Failed to update metric');
    }

    logger.info('[Metrics API] Metric updated:', { metricId });
    return NextResponse.json(metric);
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * DELETE /api/workspaces/[projectId]/metrics/[metricId]
 * Delete a metric
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; metricId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, metricId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(metricId)) {
      return badRequest('Invalid project or metric ID');
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

    // Delete metric
    const { error } = await adminClient
      .from('workspace_success_metrics')
      .delete()
      .eq('id', metricId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Metrics API] Failed to delete metric:', error);
      return internalError('Failed to delete metric');
    }

    logger.info('[Metrics API] Metric deleted:', { metricId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

