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
import type { MetricsDashboardData, SuccessMetric } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/metrics/dashboard
 * Get aggregated dashboard data for all metrics
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

    // Get all active metrics
    const { data: metrics, error } = await adminClient
      .from('workspace_success_metrics')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[Metrics API] Failed to fetch metrics:', error);
      return internalError('Failed to fetch metrics');
    }

    const allMetrics = metrics || [];

    // Calculate aggregated data
    const metricsOnTrack = allMetrics.filter((m: SuccessMetric) => m.health_status === 'on_track').length;
    const metricsAtRisk = allMetrics.filter((m: SuccessMetric) => m.health_status === 'at_risk').length;
    const metricsOffTrack = allMetrics.filter((m: SuccessMetric) => m.health_status === 'off_track').length;

    // Count by type
    const metricsByType = {
      kpi: allMetrics.filter((m: SuccessMetric) => m.metric_type === 'kpi').length,
      product_health: allMetrics.filter((m: SuccessMetric) => m.metric_type === 'product_health').length,
      business_impact: allMetrics.filter((m: SuccessMetric) => m.metric_type === 'business_impact').length,
      technical: allMetrics.filter((m: SuccessMetric) => m.metric_type === 'technical').length,
    };

    // Get recent metrics (last 10)
    const recentMetrics = allMetrics.slice(0, 10);

    const dashboardData: MetricsDashboardData = {
      total_metrics: allMetrics.length,
      metrics_on_track: metricsOnTrack,
      metrics_at_risk: metricsAtRisk,
      metrics_off_track: metricsOffTrack,
      metrics_by_type: metricsByType,
      recent_metrics: recentMetrics,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    logger.error('[Metrics API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

