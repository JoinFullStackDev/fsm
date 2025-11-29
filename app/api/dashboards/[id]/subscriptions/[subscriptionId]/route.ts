import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/dashboards/[id]/subscriptions/[subscriptionId]
 * Update a subscription
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; subscriptionId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to update subscriptions');
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

    // Get subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('dashboard_subscriptions')
      .select('*, dashboard:dashboards(*)')
      .eq('id', params.subscriptionId)
      .eq('dashboard_id', params.id)
      .eq('user_id', userData.id)
      .single();

    if (subscriptionError || !subscription) {
      return notFound('Subscription not found');
    }

    const body = await request.json();
    const { schedule_type, email, enabled } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (schedule_type !== undefined) {
      if (!['daily', 'weekly', 'monthly'].includes(schedule_type)) {
        return badRequest('Invalid schedule_type. Must be daily, weekly, or monthly');
      }
      updateData.schedule_type = schedule_type;
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return badRequest('Valid email is required');
      }
      updateData.email = email.trim();
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled === true;
    }

    const { data: updatedSubscription, error: updateError } = await supabase
      .from('dashboard_subscriptions')
      .update(updateData)
      .eq('id', params.subscriptionId)
      .select()
      .single();

    if (updateError) {
      logger.error('[Dashboards API] Error updating subscription:', updateError);
      return internalError('Failed to update subscription');
    }

    return NextResponse.json({ subscription: updatedSubscription });
  } catch (error) {
    logger.error('[Dashboards API] Error in PUT subscription:', error);
    return internalError('Failed to update subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/dashboards/[id]/subscriptions/[subscriptionId]
 * Delete a subscription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; subscriptionId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to delete subscriptions');
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

    // Get subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('dashboard_subscriptions')
      .select('id')
      .eq('id', params.subscriptionId)
      .eq('dashboard_id', params.id)
      .eq('user_id', userData.id)
      .single();

    if (subscriptionError || !subscription) {
      return notFound('Subscription not found');
    }

    const { error: deleteError } = await supabase
      .from('dashboard_subscriptions')
      .delete()
      .eq('id', params.subscriptionId);

    if (deleteError) {
      logger.error('[Dashboards API] Error deleting subscription:', deleteError);
      return internalError('Failed to delete subscription');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Dashboards API] Error in DELETE subscription:', error);
    return internalError('Failed to delete subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

