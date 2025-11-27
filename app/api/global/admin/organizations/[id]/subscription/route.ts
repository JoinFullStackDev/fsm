import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/global/admin/organizations/[id]/subscription
 * Update subscription (change package, cancel, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();
    const { action, package_id, cancel_at_period_end } = body;

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', params.id)
      .single();

    if (orgError || !organization) {
      return notFound('Organization not found');
    }

    // Get current subscription (active or trialing)
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('organization_id', params.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (action === 'change_package' && package_id) {
      const isConfigured = await isStripeConfigured();
      if (!isConfigured) {
        return badRequest('Stripe is not configured. Please configure Stripe API keys in System Settings (/global/admin/system) and ensure the connection is active.');
      }

      // Get new package
      const { data: newPackage, error: pkgError } = await adminClient
        .from('packages')
        .select('id, stripe_price_id, name, price_per_user_monthly')
        .eq('id', package_id)
        .single();

      if (pkgError || !newPackage || !newPackage.stripe_price_id) {
        return badRequest('Package not found or missing Stripe price ID');
      }

      if (subscription?.stripe_subscription_id) {
        // Update Stripe subscription
        const stripe = await getStripeClient();
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        
        // Get the subscription item ID
        const subscriptionItemId = stripeSub.items.data[0]?.id;
        
        if (subscriptionItemId) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [{
              id: subscriptionItemId,
              price: newPackage.stripe_price_id,
            }],
            proration_behavior: 'always_invoice',
          });
        } else {
          // No subscription items, add new one
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [{
              price: newPackage.stripe_price_id,
            }],
            proration_behavior: 'always_invoice',
          });
        }

        // Update database
        await adminClient
          .from('subscriptions')
          .update({
            package_id: package_id,
            stripe_price_id: newPackage.stripe_price_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
      } else {
        // Create new subscription in database
        await adminClient
          .from('subscriptions')
          .insert({
            organization_id: params.id,
            package_id: package_id,
            stripe_price_id: newPackage.stripe_price_id,
            status: 'active',
          });
      }

      return NextResponse.json({ message: 'Package changed successfully' });
    }

    if (action === 'cancel' && subscription?.stripe_subscription_id) {
      const isConfigured = await isStripeConfigured();
      if (!isConfigured) {
        return badRequest('Stripe is not configured. Please configure Stripe API keys in System Settings (/global/admin/system) and ensure the connection is active.');
      }

      const stripe = await getStripeClient();
      const cancelImmediately = cancel_at_period_end === false;

      if (cancelImmediately) {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        await adminClient
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        await adminClient
          .from('organizations')
          .update({
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);
      } else {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        await adminClient
          .from('subscriptions')
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
      }

      return NextResponse.json({ message: 'Subscription canceled successfully' });
    }

    if (action === 'reactivate' && subscription?.stripe_subscription_id) {
      const isConfigured = await isStripeConfigured();
      if (!isConfigured) {
        return badRequest('Stripe is not configured. Please configure Stripe API keys in System Settings (/global/admin/system) and ensure the connection is active.');
      }

      const stripe = await getStripeClient();
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      await adminClient
        .from('subscriptions')
        .update({
          cancel_at_period_end: false,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      await adminClient
        .from('organizations')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      return NextResponse.json({ message: 'Subscription reactivated successfully' });
    }

    return badRequest('Invalid action');
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in PUT /api/global/admin/organizations/[id]/subscription:', error);
    return internalError('Failed to update subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

