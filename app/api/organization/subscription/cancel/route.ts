import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organization/subscription/cancel
 * Cancel subscription
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const body = await request.json();
    const { cancel_immediately } = body;

    if (!(await isStripeConfigured())) {
      return badRequest('Stripe is not configured');
    }

    const adminClient = createAdminSupabaseClient();

    // Get current subscription
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, stripe_subscription_id, status, organization_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      logger.error('[Cancel Subscription] No active subscription found:', {
        organizationId,
        error: subError?.message,
      });
      return badRequest('No active subscription found');
    }

    // Verify subscription belongs to user's organization
    if (subscription.organization_id !== organizationId) {
      logger.error('[Cancel Subscription] Organization mismatch:', {
        subscriptionId: subscription.id,
        subscriptionOrgId: subscription.organization_id,
        userOrgId: organizationId,
      });
      return badRequest('Subscription does not belong to your organization');
    }

    if (subscription.status === 'canceled') {
      return badRequest('Subscription is already canceled');
    }

    // Require stripe_subscription_id for cancellation
    if (!subscription.stripe_subscription_id) {
      logger.error('[Cancel Subscription] Missing stripe_subscription_id:', {
        subscriptionId: subscription.id,
        organizationId,
      });
      return badRequest(
        'This subscription cannot be canceled automatically. Please contact support to cancel your subscription.'
      );
    }

    // Log cancellation attempt
    logger.info('[Cancel Subscription] Canceling subscription:', {
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      organizationId,
      cancelImmediately: cancel_immediately,
    });

    // Cancel in Stripe
    if (subscription.stripe_subscription_id) {
      const stripe = await getStripeClient();

      if (cancel_immediately) {
        // Cancel immediately
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } else {
        // Cancel at period end
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }
    }

    // Update database
    if (cancel_immediately) {
      await adminClient
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      // Update organization status
      await adminClient
        .from('organizations')
        .update({
          subscription_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);
    } else {
      await adminClient
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);
    }

    // Return success with cache invalidation flag
    // Client will clear cache when it sees this flag
    return NextResponse.json({ 
      success: true,
      clearCache: true, // Signal client to clear package context cache
    });
  } catch (error) {
    logger.error('Error in POST /api/organization/subscription/cancel:', error);
    return internalError('Failed to cancel subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

