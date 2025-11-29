import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboards/[id]
 * Get a single dashboard with its widgets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view dashboards');
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

    // Get dashboard
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('*')
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
      .eq('dashboard_id', params.id)
      .order('created_at', { ascending: true });

    if (widgetsError) {
      logger.error('[Dashboards API] Error fetching widgets:', widgetsError);
    }

    return NextResponse.json({
      dashboard: {
        ...dashboard,
        widgets: widgets || [],
      },
    });
  } catch (error) {
    logger.error('[Dashboards API] Error in GET:', error);
    return internalError('Failed to load dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/dashboards/[id]
 * Update a dashboard
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to update dashboards');
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

    // Get existing dashboard
    const { data: existingDashboard, error: existingError } = await supabase
      .from('dashboards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (existingError || !existingDashboard) {
      return notFound('Dashboard not found');
    }

    // Verify access and permissions
    if (existingDashboard.is_personal) {
      if (existingDashboard.owner_id !== userData.id) {
        return forbidden('You do not have permission to update this dashboard');
      }
    } else if (existingDashboard.organization_id) {
      if (existingDashboard.organization_id !== organizationId) {
        return forbidden('You do not have permission to update this dashboard');
      }
      // Only admins and PMs can update org dashboards
      if (userData.role !== 'admin' && userData.role !== 'pm') {
        return forbidden('Only admins and PMs can update organization dashboards');
      }
    } else if (existingDashboard.project_id) {
      // Check project membership
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', existingDashboard.project_id)
        .single();

      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', existingDashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have permission to update this dashboard');
      }
    }

    const body = await request.json();
    const { name, description, is_default, layout } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return badRequest('Dashboard name cannot be empty');
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (is_default !== undefined) {
      updateData.is_default = is_default === true;

      // If setting as default, unset other defaults in the same scope
      if (is_default === true) {
        let unsetQuery = supabase
          .from('dashboards')
          .update({ is_default: false })
          .eq('is_default', true)
          .neq('id', params.id);

        if (existingDashboard.is_personal) {
          unsetQuery = unsetQuery.eq('owner_id', userData.id).eq('is_personal', true);
        } else if (existingDashboard.organization_id) {
          unsetQuery = unsetQuery.eq('organization_id', existingDashboard.organization_id).eq('is_personal', false).is('project_id', null);
        } else if (existingDashboard.project_id) {
          unsetQuery = unsetQuery.eq('project_id', existingDashboard.project_id).eq('is_personal', false);
        }

        await unsetQuery;
      }
    }

    if (layout !== undefined) {
      updateData.layout = layout || {};
    }

    const { data: dashboard, error: updateError } = await supabase
      .from('dashboards')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('[Dashboards API] Error updating dashboard:', updateError);
      return internalError('Failed to update dashboard');
    }

    return NextResponse.json({ dashboard });
  } catch (error) {
    logger.error('[Dashboards API] Error in PUT:', error);
    return internalError('Failed to update dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/dashboards/[id]
 * Delete a dashboard
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to delete dashboards');
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

    // Get existing dashboard
    const { data: existingDashboard, error: existingError } = await supabase
      .from('dashboards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (existingError || !existingDashboard) {
      return notFound('Dashboard not found');
    }

    // Verify access and permissions
    if (existingDashboard.is_personal) {
      if (existingDashboard.owner_id !== userData.id) {
        return forbidden('You do not have permission to delete this dashboard');
      }
    } else if (existingDashboard.organization_id) {
      if (existingDashboard.organization_id !== organizationId) {
        return forbidden('You do not have permission to delete this dashboard');
      }
      // Only admins and PMs can delete org dashboards
      if (userData.role !== 'admin' && userData.role !== 'pm') {
        return forbidden('Only admins and PMs can delete organization dashboards');
      }
    } else if (existingDashboard.project_id) {
      // Check project membership
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', existingDashboard.project_id)
        .single();

      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', existingDashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have permission to delete this dashboard');
      }
    }

    // Delete dashboard (widgets will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('[Dashboards API] Error deleting dashboard:', deleteError);
      return internalError('Failed to delete dashboard');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Dashboards API] Error in DELETE:', error);
    return internalError('Failed to delete dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

