import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboards/[id]/duplicate
 * Duplicate a dashboard with all its widgets
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to duplicate dashboards');
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
      return internalError('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get dashboard
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (dashboardError || !dashboard) {
      return notFound('Dashboard not found');
    }

    // Verify access (read access is sufficient for duplication)
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.project_id) {
      // Check project membership
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

    // Get widgets
    const { data: widgets, error: widgetsError } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('dashboard_id', params.id);

    if (widgetsError) {
      logger.error('[Dashboards API] Error fetching widgets for duplication:', widgetsError);
    }

    const body = await request.json();
    const { name } = body;

    // Create new dashboard
    const newDashboardData: Record<string, unknown> = {
      owner_id: userData.id,
      name: name || `${dashboard.name} (Copy)`,
      description: dashboard.description,
      is_personal: dashboard.is_personal,
      is_default: false, // Never duplicate as default
      layout: dashboard.layout || {},
    };

    if (dashboard.organization_id) {
      newDashboardData.organization_id = dashboard.organization_id;
    }
    if (dashboard.project_id) {
      newDashboardData.project_id = dashboard.project_id;
    }

    const { data: newDashboard, error: insertError } = await supabase
      .from('dashboards')
      .insert(newDashboardData)
      .select()
      .single();

    if (insertError) {
      logger.error('[Dashboards API] Error creating duplicated dashboard:', insertError);
      return internalError('Failed to duplicate dashboard');
    }

    // Duplicate widgets
    if (widgets && widgets.length > 0) {
      const newWidgets = widgets.map(widget => ({
        dashboard_id: newDashboard.id,
        widget_type: widget.widget_type,
        dataset: widget.dataset,
        position: widget.position,
        settings: widget.settings,
      }));

      const { error: widgetsInsertError } = await supabase
        .from('dashboard_widgets')
        .insert(newWidgets);

      if (widgetsInsertError) {
        logger.error('[Dashboards API] Error duplicating widgets:', widgetsInsertError);
        // Continue anyway - dashboard is created
      }
    }

    // Get the new dashboard with widgets
    const { data: dashboardWithWidgets, error: fetchError } = await supabase
      .from('dashboards')
      .select('*, widgets:dashboard_widgets(*)')
      .eq('id', newDashboard.id)
      .single();

    if (fetchError) {
      logger.error('[Dashboards API] Error fetching duplicated dashboard:', fetchError);
    }

    return NextResponse.json({
      dashboard: dashboardWithWidgets || newDashboard,
    }, { status: 201 });
  } catch (error) {
    logger.error('[Dashboards API] Error in POST duplicate:', error);
    return internalError('Failed to duplicate dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

