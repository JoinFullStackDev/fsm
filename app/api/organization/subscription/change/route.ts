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
    const { package_id, billing_interval } = body;

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
      .select('id, stripe_subscription_id, package_id, billing_interval')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return badRequest('No active subscription found');
    }

    // Determine billing interval: use provided one, or fall back to existing subscription's interval, or default to 'month'
    const targetBillingInterval = billing_interval || subscription.billing_interval || 'month';

    // Get new package with all pricing fields
    const { data: newPackage, error: pkgError } = await adminClient
      .from('packages')
      .select('id, stripe_price_id_monthly, stripe_price_id_yearly, stripe_product_id, name, pricing_model, price_per_user_monthly, price_per_user_yearly, base_price_monthly, base_price_yearly')
      .eq('id', package_id)
      .single();

    if (pkgError || !newPackage) {
      return badRequest('Package not found');
    }

    // Get the correct price ID based on billing interval
    let priceId = targetBillingInterval === 'month' 
      ? newPackage.stripe_price_id_monthly 
      : newPackage.stripe_price_id_yearly;
    
    // If no price ID but we have product ID, try to find/create price
    if (!priceId && newPackage.stripe_product_id) {
      const stripe = await getStripeClient();
      try {
        const prices = await stripe.prices.list({
          product: newPackage.stripe_product_id,
          active: true,
        });
        // Find price matching the billing interval
        const matchingPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === targetBillingInterval
        );
        if (matchingPrice) {
          // Check if the price is metered - if so and it's per-user pricing, create a licensed replacement
          const isMetered = matchingPrice.recurring?.usage_type === 'metered';
          const pricingModel = newPackage.pricing_model || 'per_user';
          if (isMetered && pricingModel === 'per_user') {
            logger.info('[Stripe] Metered price found for per-user pricing, creating licensed replacement:', {
              priceId: matchingPrice.id,
              packageId: package_id,
              interval: targetBillingInterval,
            });

            const unitAmount = pricingModel === 'per_user'
              ? (targetBillingInterval === 'month' ? (newPackage.price_per_user_monthly || 0) : (newPackage.price_per_user_yearly || 0))
              : (targetBillingInterval === 'month' ? (newPackage.base_price_monthly || 0) : (newPackage.base_price_yearly || 0));

            const newPrice = await stripe.prices.create({
              product: newPackage.stripe_product_id,
              unit_amount: Math.round(unitAmount * 100),
              currency: 'usd',
              recurring: {
                interval: targetBillingInterval,
                usage_type: 'licensed',
              },
            });

            priceId = newPrice.id;
            const updateField = targetBillingInterval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
            await adminClient
              .from('packages')
              .update({ [updateField]: priceId })
              .eq('id', package_id);

            logger.info('[Stripe] Created licensed price replacement:', {
              oldPriceId: matchingPrice.id,
              newPriceId: priceId,
            });
          } else {
            priceId = matchingPrice.id;
            // Update package with found price ID
            const updateField = targetBillingInterval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
            await adminClient
              .from('packages')
              .update({ [updateField]: priceId })
              .eq('id', package_id);
          }
        } else {
          // Create price if it doesn't exist
          const pricingModel = newPackage.pricing_model || 'per_user';
          const unitAmount = pricingModel === 'per_user'
            ? (targetBillingInterval === 'month' ? (newPackage.price_per_user_monthly || 0) : (newPackage.price_per_user_yearly || 0))
            : (targetBillingInterval === 'month' ? (newPackage.base_price_monthly || 0) : (newPackage.base_price_yearly || 0));

          const newPrice = await stripe.prices.create({
            product: newPackage.stripe_product_id,
            unit_amount: Math.round(unitAmount * 100),
            currency: 'usd',
            recurring: {
              interval: targetBillingInterval,
              usage_type: 'licensed', // Explicitly set to licensed for proper quantity support
            },
          });
          priceId = newPrice.id;
          // Update package with new price ID
          const updateField = targetBillingInterval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
          await adminClient
            .from('packages')
            .update({ [updateField]: priceId })
            .eq('id', package_id);
        }
      } catch (stripeError) {
        logger.error('Error getting/creating price:', stripeError);
        return badRequest('Failed to get price for package');
      }
    }

    if (!priceId) {
      return badRequest(`Package does not have a valid Stripe price for ${targetBillingInterval}ly billing`);
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
            billing_interval: targetBillingInterval,
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
            billing_interval: targetBillingInterval,
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
        billing_interval: targetBillingInterval,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    // Return success with cache invalidation flag
    // Client will clear cache when it sees this flag
    return NextResponse.json({ 
      success: true,
      clearCache: true, // Signal client to clear package context cache
    });
  } catch (error) {
    logger.error('Error in POST /api/organization/subscription/change:', error);
    return internalError('Failed to change package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

