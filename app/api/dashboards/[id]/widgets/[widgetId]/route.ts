import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/dashboards/[id]/widgets/[widgetId]
 * Update a widget
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; widgetId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to update widgets');
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

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Check module access
    const hasAccess = await hasCustomDashboards(adminClient, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get widget and dashboard using admin client
    const { data: widget, error: widgetError } = await adminClient
      .from('dashboard_widgets')
      .select('*, dashboard:dashboards(*)')
      .eq('id', params.widgetId)
      .eq('dashboard_id', params.id)
      .single();

    if (widgetError || !widget) {
      return notFound('Widget not found');
    }

    const dashboard = (widget as any).dashboard;

    // Verify access
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have permission to update this widget');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have permission to update this widget');
      }
      // Only admins and PMs can update widgets in org dashboards
      if (userData.role !== 'admin' && userData.role !== 'pm') {
        return forbidden('Only admins and PMs can update widgets in organization dashboards');
      }
    } else if (dashboard.project_id) {
      // Check project membership using admin client
      const { data: project } = await adminClient
        .from('projects')
        .select('owner_id')
        .eq('id', dashboard.project_id)
        .single();

      const { data: member } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', dashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have permission to update this widget');
      }
    }

    const body = await request.json();
    const { dataset, position, settings } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dataset !== undefined) {
      updateData.dataset = dataset;
    }
    if (position !== undefined) {
      updateData.position = position;
    }
    if (settings !== undefined) {
      updateData.settings = settings;
    }

    const { data: updatedWidget, error: updateError } = await adminClient
      .from('dashboard_widgets')
      .update(updateData)
      .eq('id', params.widgetId)
      .select()
      .single();

    if (updateError) {
      logger.error('[Dashboards API] Error updating widget:', updateError);
      return internalError('Failed to update widget');
    }

    return NextResponse.json({ widget: updatedWidget });
  } catch (error) {
    logger.error('[Dashboards API] Error in PUT widget:', error);
    return internalError('Failed to update widget', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/dashboards/[id]/widgets/[widgetId]
 * Delete a widget
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; widgetId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to delete widgets');
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

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Check module access
    const hasAccess = await hasCustomDashboards(adminClient, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get widget and dashboard using admin client
    const { data: widget, error: widgetError } = await adminClient
      .from('dashboard_widgets')
      .select('*, dashboard:dashboards(*)')
      .eq('id', params.widgetId)
      .eq('dashboard_id', params.id)
      .single();

    if (widgetError || !widget) {
      return notFound('Widget not found');
    }

    const dashboard = (widget as any).dashboard;

    // Verify access
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have permission to delete this widget');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have permission to delete this widget');
      }
      // Only admins and PMs can delete widgets in org dashboards
      if (userData.role !== 'admin' && userData.role !== 'pm') {
        return forbidden('Only admins and PMs can delete widgets in organization dashboards');
      }
    } else if (dashboard.project_id) {
      // Check project membership using admin client
      const { data: project } = await adminClient
        .from('projects')
        .select('owner_id')
        .eq('id', dashboard.project_id)
        .single();

      const { data: member } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', dashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have permission to delete this widget');
      }
    }

    const { error: deleteError } = await adminClient
      .from('dashboard_widgets')
      .delete()
      .eq('id', params.widgetId);

    if (deleteError) {
      logger.error('[Dashboards API] Error deleting widget:', deleteError);
      return internalError('Failed to delete widget');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Dashboards API] Error in DELETE widget:', error);
    return internalError('Failed to delete widget', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

