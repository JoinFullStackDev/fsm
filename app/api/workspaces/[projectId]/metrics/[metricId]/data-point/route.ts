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
import type { DataPoint } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/metrics/[metricId]/data-point
 * Add a data point to a metric
 */
export async function POST(
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

    // Get current metric
    const { data: metric, error: metricError } = await adminClient
      .from('workspace_success_metrics')
      .select('*')
      .eq('id', metricId)
      .eq('workspace_id', workspace.id)
      .single();

    if (metricError || !metric) {
      return notFound('Metric not found');
    }

    const body = await request.json();

    // Validate data point
    if (!body.date || body.value === undefined) {
      return badRequest('Date and value are required');
    }

    const newDataPoint: DataPoint = {
      date: body.date,
      value: body.value,
    };

    // Get existing data points
    const existingDataPoints = (metric.data_points as DataPoint[]) || [];

    // Add new data point (remove duplicates by date)
    const filteredDataPoints = existingDataPoints.filter(
      (dp: DataPoint) => dp.date !== newDataPoint.date
    );
    const updatedDataPoints = [...filteredDataPoints, newDataPoint].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Update current value
    const updatedCurrentValue = newDataPoint.value;

    // Calculate health status if target is set
    let healthStatus = metric.health_status;
    if (metric.target_value !== null && metric.target_value !== undefined) {
      const percentageOfTarget = (updatedCurrentValue / metric.target_value) * 100;
      if (percentageOfTarget >= 90) {
        healthStatus = 'on_track';
      } else if (percentageOfTarget >= 70) {
        healthStatus = 'at_risk';
      } else {
        healthStatus = 'off_track';
      }
    }

    // Update metric with new data point
    const { data: updatedMetric, error: updateError } = await adminClient
      .from('workspace_success_metrics')
      .update({
        data_points: updatedDataPoints,
        current_value: updatedCurrentValue,
        health_status: healthStatus,
      })
      .eq('id', metricId)
      .select()
      .single();

    if (updateError) {
      logger.error('[Metrics API] Failed to add data point:', updateError);
      return internalError('Failed to add data point');
    }

    logger.info('[Metrics API] Data point added:', { metricId, dataPoint: newDataPoint });
    return NextResponse.json(updatedMetric);
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

