import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organization/subscription/change
 * Change subscription package (upgrade/downgrade)
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
    const { package_id } = body;

    if (!package_id) {
      return badRequest('Missing required field: package_id');
    }

    if (!(await isStripeConfigured())) {
      return badRequest('Stripe is not configured');
    }

    const adminClient = createAdminSupabaseClient();

    // Get current subscription
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, stripe_subscription_id, package_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return badRequest('No active subscription found');
    }

    // Get new package
    const { data: newPackage, error: pkgError } = await adminClient
      .from('packages')
      .select('id, stripe_price_id, stripe_product_id, name, price_per_user_monthly')
      .eq('id', package_id)
      .single();

    if (pkgError || !newPackage) {
      return badRequest('Package not found');
    }

    // Get price ID (from package or product)
    let priceId = newPackage.stripe_price_id;
    
    if (!priceId && newPackage.stripe_product_id) {
      const stripe = await getStripeClient();
      try {
        const prices = await stripe.prices.list({
          product: newPackage.stripe_product_id,
          active: true,
        });
        const monthlyPrice = prices.data.find((p) => p.recurring && p.recurring.interval === 'month');
        if (monthlyPrice) {
          priceId = monthlyPrice.id;
        } else {
          // Create price if it doesn't exist
          const newPrice = await stripe.prices.create({
            product: newPackage.stripe_product_id,
            unit_amount: Math.round(newPackage.price_per_user_monthly * 100),
            currency: 'usd',
            recurring: { interval: 'month' },
          });
          priceId = newPrice.id;
        }
      } catch (stripeError) {
        logger.error('Error getting/creating price:', stripeError);
        return badRequest('Failed to get price for package');
      }
    }

    if (!priceId) {
      return badRequest('Package does not have a valid Stripe price');
    }

    // Update Stripe subscription if it exists
    if (subscription.stripe_subscription_id) {
      const stripe = await getStripeClient();
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

      const subscriptionItemId = stripeSub.items.data[0]?.id;

      if (subscriptionItemId) {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          items: [
            {
              id: subscriptionItemId,
              price: priceId,
            },
          ],
          proration_behavior: 'always_invoice',
          metadata: {
            package_id: package_id,
          },
        });
      } else {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          items: [
            {
              price: priceId,
            },
          ],
          proration_behavior: 'always_invoice',
          metadata: {
            package_id: package_id,
          },
        });
      }
    }

    // Update database
    await adminClient
      .from('subscriptions')
      .update({
        package_id: package_id,
        stripe_price_id: priceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in POST /api/organization/subscription/change:', error);
    return internalError('Failed to change package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

