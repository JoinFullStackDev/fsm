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
import type { DebtHeatmapData } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/debt/heatmap
 * Get aggregated debt data for heatmap visualization
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

    // Get all debt items with calculated age
    const { data: debtItems, error } = await adminClient
      .from('workspace_debt')
      .select('debt_type, severity, status, identified_date, impact_areas')
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Debt Heatmap API] Failed to fetch debt items:', error);
      return internalError('Failed to fetch debt data');
    }

    if (!debtItems || debtItems.length === 0) {
      // Return empty heatmap
      const emptyHeatmap: DebtHeatmapData = {
        by_type: { technical: 0, product: 0, design: 0, operational: 0 },
        by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
        by_status: { open: 0, in_progress: 0, resolved: 0, wont_fix: 0 },
        average_age_days: 0,
        oldest_item_age_days: 0,
        total_count: 0,
      };
      return NextResponse.json(emptyHeatmap);
    }

    // Aggregate data
    const byType = { technical: 0, product: 0, design: 0, operational: 0 };
    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    const byStatus = { open: 0, in_progress: 0, resolved: 0, wont_fix: 0 };
    let totalAge = 0;
    let maxAge = 0;

    debtItems.forEach((item) => {
      // Count by type
      if (item.debt_type in byType) {
        byType[item.debt_type as keyof typeof byType]++;
      }

      // Count by severity
      if (item.severity in bySeverity) {
        bySeverity[item.severity as keyof typeof bySeverity]++;
      }

      // Count by status
      if (item.status in byStatus) {
        byStatus[item.status as keyof typeof byStatus]++;
      }

      // Calculate age in days
      const identifiedDate = new Date(item.identified_date);
      const today = new Date();
      const age = Math.floor((today.getTime() - identifiedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      totalAge += age;
      if (age > maxAge) {
        maxAge = age;
      }
    });

    const averageAge = debtItems.length > 0 ? Math.round(totalAge / debtItems.length) : 0;

    const heatmap: DebtHeatmapData = {
      by_type: byType,
      by_severity: bySeverity,
      by_status: byStatus,
      average_age_days: averageAge,
      oldest_item_age_days: maxAge,
      total_count: debtItems.length,
    };

    return NextResponse.json(heatmap);
  } catch (error) {
    logger.error('[Debt Heatmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
