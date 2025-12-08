import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboards/[id]/export/json
 * Export dashboard structure as JSON
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to export dashboards');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User record not found');
      }
      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get dashboard with widgets
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('*, widgets:dashboard_widgets(*)')
      .eq('id', params.id)
      .single();

    if (dashboardError || !dashboard) {
      return notFound('Dashboard not found');
    }

    // Verify access
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', dashboard.project_id)
        .single();

      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', dashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have access to this dashboard');
      }
    }

    // Export structure (without sensitive data)
    interface DashboardWidget {
      widget_type: string;
      dataset?: Record<string, unknown>;
      position?: Record<string, unknown>;
      settings?: Record<string, unknown>;
    }
    
    const dashboardRecord = dashboard as Record<string, unknown>;
    const widgets = (dashboardRecord.widgets as DashboardWidget[] | undefined)?.map(w => ({
      widget_type: w.widget_type,
      dataset: w.dataset,
      position: w.position,
      settings: w.settings,
    })) || [];
    
    const exportData = {
      name: dashboard.name,
      description: dashboard.description,
      is_personal: dashboard.is_personal,
      layout: dashboard.layout,
      widgets,
      exported_at: new Date().toISOString(),
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="dashboard_${params.id}.json"`,
      },
    });
  } catch (error) {
    logger.error('[Dashboards API] Error in GET export JSON:', error);
    return internalError('Failed to export dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

