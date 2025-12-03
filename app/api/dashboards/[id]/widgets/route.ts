import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboards/[id]/widgets
 * Create a new widget for a dashboard
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to create widgets');
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

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Get dashboard and verify access using admin client
    const { data: dashboard, error: dashboardError } = await adminClient
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
        return forbidden('You do not have permission to add widgets to this dashboard');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have permission to add widgets to this dashboard');
      }
      // Only admins and PMs can add widgets to org dashboards
      if (userData.role !== 'admin' && userData.role !== 'pm') {
        return forbidden('Only admins and PMs can add widgets to organization dashboards');
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
        return forbidden('You do not have permission to add widgets to this dashboard');
      }
    }

    const body = await request.json();
    const { widget_type, dataset, position, settings } = body;

    if (!widget_type || !['metric', 'chart', 'table', 'ai_insight', 'rich_text'].includes(widget_type)) {
      return badRequest('Invalid widget type');
    }

    // Set default height based on widget type if not provided
    let defaultHeight = 3; // Default for metric and rich_text
    if (widget_type === 'chart' || widget_type === 'table') {
      defaultHeight = 8;
    } else if (widget_type === 'ai_insight') {
      defaultHeight = 14;
    }

    // Ensure position has default height if not provided
    const finalPosition = {
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      w: position?.w ?? 4,
      h: position?.h ?? defaultHeight,
    };

    const insertData: any = {
      dashboard_id: params.id,
      widget_type,
      dataset: dataset || {},
      position: finalPosition,
      settings: settings || {},
    };

    // Create widget using admin client
    const { data: widget, error: insertError } = await adminClient
      .from('dashboard_widgets')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      logger.error('[Dashboards API] Error creating widget:', insertError);
      return internalError('Failed to create widget');
    }

    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    logger.error('[Dashboards API] Error in POST widget:', error);
    return internalError('Failed to create widget', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

