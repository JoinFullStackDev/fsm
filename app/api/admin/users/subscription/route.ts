import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { updateSubscriptionQuantityForUsers } from '@/lib/stripe/adminSubscriptionUpdates';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/subscription
 * Update subscription quantity when users are added/removed
 * This is a separate endpoint from the main subscription flow
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update subscription');
    }

    // Get current user and verify admin role
    const adminClient = createAdminSupabaseClient();
    const { data: currentUser, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !currentUser) {
      return unauthorized('User not found');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    // Get user's organization
    const organizationId = currentUser.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Update subscription quantity
    const result = await updateSubscriptionQuantityForUsers(organizationId);

    if (!result.success) {
      logger.error('[Admin Users Subscription] Failed to update subscription:', {
        organizationId,
        error: result.error,
      });
      return internalError(result.error || 'Failed to update subscription');
    }

    logger.info('[Admin Users Subscription] Successfully updated subscription', {
      organizationId,
      newQuantity: result.newQuantity,
    });

    return NextResponse.json({
      success: true,
      newQuantity: result.newQuantity,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    logger.error('[Admin Users Subscription] Unexpected error:', error);
    return internalError('Failed to update subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
