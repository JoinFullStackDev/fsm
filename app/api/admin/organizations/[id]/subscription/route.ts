import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/organizations/[id]/subscription
 * Update organization subscription (super admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Check if user is super admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      return forbidden('Super admin access required');
    }

    const { id: organizationId } = params;
    const body = await request.json();
    const { package_id } = body;

    if (!package_id) {
      return badRequest('Missing required field: package_id');
    }

    const adminClient = createAdminSupabaseClient();

    // Verify package exists
    const { data: packageData, error: pkgError } = await adminClient
      .from('packages')
      .select('id')
      .eq('id', package_id)
      .single();

    if (pkgError || !packageData) {
      return badRequest('Package not found');
    }

    // Check if subscription exists
    const { data: existingSub, error: subError } = await adminClient
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (subError) {
      logger.error('Error checking subscription:', subError);
      return internalError('Failed to check subscription', { error: subError.message });
    }

    if (existingSub) {
      // Update existing subscription
      const { error: updateError } = await adminClient
        .from('subscriptions')
        .update({
          package_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSub.id);

      if (updateError) {
        logger.error('Error updating subscription:', updateError);
        return internalError('Failed to update subscription', { error: updateError.message });
      }
    } else {
      // Create new subscription
      const { error: createError } = await adminClient.from('subscriptions').insert({
        organization_id: organizationId,
        package_id,
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      });

      if (createError) {
        logger.error('Error creating subscription:', createError);
        return internalError('Failed to create subscription', { error: createError.message });
      }

      // Update organization subscription status
      // Note: organizations.subscription_status uses 'trial' (not 'trialing')
      await adminClient
        .from('organizations')
        .update({
          subscription_status: 'trial', // organizations table enum uses 'trial'
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in PATCH /api/admin/organizations/[id]/subscription:', error);
    return internalError('Failed to update subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

