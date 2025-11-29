import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboards/[id]/subscriptions
 * List subscriptions for a dashboard
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view subscriptions');
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

    // Get subscriptions (only user's own subscriptions)
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('dashboard_subscriptions')
      .select('*')
      .eq('dashboard_id', params.id)
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    if (subscriptionsError) {
      logger.error('[Dashboards API] Error fetching subscriptions:', subscriptionsError);
      return internalError('Failed to fetch subscriptions');
    }

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    logger.error('[Dashboards API] Error in GET subscriptions:', error);
    return internalError('Failed to load subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/dashboards/[id]/subscriptions
 * Create a subscription for scheduled reports
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to create subscriptions');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin, email')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin, email')
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

    const body = await request.json();
    const { schedule_type, email, enabled } = body;

    if (!schedule_type || !['daily', 'weekly', 'monthly'].includes(schedule_type)) {
      return badRequest('Invalid schedule_type. Must be daily, weekly, or monthly');
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return badRequest('Valid email is required');
    }

    // Check if subscription already exists
    const { data: existing } = await supabase
      .from('dashboard_subscriptions')
      .select('id')
      .eq('dashboard_id', params.id)
      .eq('user_id', userData.id)
      .single();

    let subscription;
    if (existing) {
      // Update existing subscription
      const { data: updated, error: updateError } = await supabase
        .from('dashboard_subscriptions')
        .update({
          schedule_type,
          email: email.trim(),
          enabled: enabled !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        logger.error('[Dashboards API] Error updating subscription:', updateError);
        return internalError('Failed to update subscription');
      }
      subscription = updated;
    } else {
      // Create new subscription
      const { data: created, error: createError } = await supabase
        .from('dashboard_subscriptions')
        .insert({
          dashboard_id: params.id,
          user_id: userData.id,
          schedule_type,
          email: email.trim(),
          enabled: enabled !== false,
        })
        .select()
        .single();

      if (createError) {
        logger.error('[Dashboards API] Error creating subscription:', createError);
        return internalError('Failed to create subscription');
      }
      subscription = created;
    }

    return NextResponse.json({ subscription }, { status: existing ? 200 : 201 });
  } catch (error) {
    logger.error('[Dashboards API] Error in POST subscription:', error);
    return internalError('Failed to create subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

