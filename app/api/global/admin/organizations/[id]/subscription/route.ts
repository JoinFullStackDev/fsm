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
    const { action, package_id, cancel_at_period_end, billing_interval } = body;

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

      // Determine billing interval: use provided one, or fall back to existing subscription's interval, or default to 'month'
      const targetBillingInterval = billing_interval || subscription?.billing_interval || 'month';

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
              price: priceId,
            }],
            proration_behavior: 'always_invoice',
            metadata: {
              package_id: package_id,
              billing_interval: targetBillingInterval,
            },
          });
        } else {
          // No subscription items, add new one
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [{
              price: priceId,
            }],
            proration_behavior: 'always_invoice',
            metadata: {
              package_id: package_id,
              billing_interval: targetBillingInterval,
            },
          });
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
      } else {
        // Create new subscription in database
        await adminClient
          .from('subscriptions')
          .insert({
            organization_id: params.id,
            package_id: package_id,
            stripe_price_id: priceId,
            billing_interval: targetBillingInterval,
            status: 'active',
          });
      }

      return NextResponse.json({ 
        message: 'Package changed successfully',
        clearCache: true, // Signal client to clear package context cache
      });
    }

    if (action === 'gift_package' && package_id) {
      // Gift a package to an organization without Stripe payment
      // This is for super admin gifting accounts
      
      // Get package details
      const { data: packageData, error: pkgError } = await adminClient
        .from('packages')
        .select('id, name')
        .eq('id', package_id)
        .single();

      if (pkgError || !packageData) {
        return badRequest('Package not found');
      }

      // Determine billing interval: use provided one, or fall back to existing subscription's interval, or default to 'month'
      const targetBillingInterval = billing_interval || subscription?.billing_interval || 'month';

      // Calculate period dates
      const periodStart = new Date().toISOString();
      const periodEnd = new Date();
      if (targetBillingInterval === 'year') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (subscription) {
        // Update existing subscription
        await adminClient
          .from('subscriptions')
          .update({
            package_id: package_id,
            stripe_subscription_id: null, // Clear Stripe ID if it exists
            stripe_price_id: null, // Clear price ID
            billing_interval: targetBillingInterval,
            status: 'active',
            current_period_start: periodStart,
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        logger.info('[GiftPackage] Updated existing subscription:', {
          subscriptionId: subscription.id,
          organizationId: params.id,
          packageId: package_id,
          billingInterval: targetBillingInterval,
        });
      } else {
        // Create new subscription without Stripe
        await adminClient
          .from('subscriptions')
          .insert({
            organization_id: params.id,
            package_id: package_id,
            stripe_subscription_id: null,
            stripe_price_id: null,
            billing_interval: targetBillingInterval,
            status: 'active',
            current_period_start: periodStart,
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
          });

        logger.info('[GiftPackage] Created new subscription:', {
          organizationId: params.id,
          packageId: package_id,
          billingInterval: targetBillingInterval,
        });
      }

      // Update organization status to active (no trial for gifted accounts)
      await adminClient
        .from('organizations')
        .update({
          subscription_status: 'active',
          trial_ends_at: null, // No trial for gifted accounts
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      logger.info('[GiftPackage] Successfully gifted package to organization:', {
        organizationId: params.id,
        packageId: package_id,
        packageName: packageData.name,
        billingInterval: targetBillingInterval,
      });

      return NextResponse.json({ 
        message: 'Package gifted successfully',
        clearCache: true, // Signal client to clear package context cache
        package: {
          id: package_id,
          name: packageData.name,
        },
      });
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

      return NextResponse.json({ 
        message: 'Subscription canceled successfully',
        clearCache: true, // Signal client to clear package context cache
      });
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

      return NextResponse.json({ 
        message: 'Subscription reactivated successfully',
        clearCache: true, // Signal client to clear package context cache
      });
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

