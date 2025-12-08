/**
 * Stripe subscription management utilities
 */

import { getStripeClient, isStripeConfigured } from './client';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import Stripe from 'stripe';
import type { SubscriptionRow } from '@/types/database';

/**
 * Create a Stripe customer for an organization
 */
export async function createStripeCustomer(
  organizationId: string,
  email: string,
  name: string
): Promise<string | null> {
  if (!(await isStripeConfigured())) {
    logger.warn('[Stripe] Stripe is not configured, skipping customer creation');
    return null;
  }

  try {
    const stripe = await getStripeClient();
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        organization_id: organizationId,
      },
    });

    // Update organization with Stripe customer ID
    const supabase = createAdminSupabaseClient();
    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', organizationId);

    logger.debug('[Stripe] Created customer:', { organizationId, customerId: customer.id });
    return customer.id;
  } catch (error) {
    logger.error('[Stripe] Error creating customer:', error);
    return null;
  }
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  organizationId: string,
  packageId: string,
  successUrl: string,
  cancelUrl: string,
  billingInterval: 'month' | 'year' = 'month'
): Promise<string | null> {
  if (!(await isStripeConfigured())) {
    logger.warn('[Stripe] Stripe is not configured, skipping checkout session creation');
    return null;
  }

  try {
    const supabase = createAdminSupabaseClient();

    // Get organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      logger.error('[Stripe] Organization not found:', orgError);
      return null;
    }

    // Get package
    const { data: packageData, error: pkgError } = await supabase
      .from('packages')
      .select('id, stripe_price_id_monthly, stripe_price_id_yearly, stripe_product_id, pricing_model, base_price_monthly, base_price_yearly, price_per_user_monthly, price_per_user_yearly')
      .eq('id', packageId)
      .single();

    if (pkgError || !packageData) {
      logger.error('[Stripe] Package not found:', pkgError);
      return null;
    }

    // Get the appropriate price ID based on billing interval
    let priceId = billingInterval === 'month' 
      ? packageData.stripe_price_id_monthly 
      : packageData.stripe_price_id_yearly;
    
    // If no price ID but we have product ID, try to find/create price
    if (!priceId && packageData.stripe_product_id) {
      const stripe = await getStripeClient();
      try {
        // Get all prices for this product
        const prices = await stripe.prices.list({
          product: packageData.stripe_product_id,
          active: true,
        });

        // Find a price matching the billing interval
        const matchingPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === billingInterval
        );

        if (matchingPrice) {
          // Check if the price is metered - if so and it's per-user pricing, create a licensed replacement
          const isMetered = matchingPrice.recurring?.usage_type === 'metered';
          if (isMetered && (packageData.pricing_model || 'per_user') === 'per_user') {
            logger.info('[Stripe] Metered price found for per-user pricing, creating licensed replacement:', {
              priceId: matchingPrice.id,
              packageId,
              interval: billingInterval,
            });

            const unitAmount = billingInterval === 'month'
              ? (packageData.price_per_user_monthly || 0)
              : (packageData.price_per_user_yearly || 0);

            const newPrice = await stripe.prices.create({
              product: packageData.stripe_product_id,
              unit_amount: Math.round(unitAmount * 100),
              currency: 'usd',
              recurring: {
                interval: billingInterval,
                usage_type: 'licensed',
              },
            });

            priceId = newPrice.id;
            const updateField = billingInterval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
            await supabase
              .from('packages')
              .update({ [updateField]: priceId })
              .eq('id', packageId);

            logger.info('[Stripe] Created licensed price replacement:', {
              oldPriceId: matchingPrice.id,
              newPriceId: priceId,
            });
          } else {
            priceId = matchingPrice.id;
            // Update package with found price ID for the correct interval
            const updateField = billingInterval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
            await supabase
              .from('packages')
              .update({ [updateField]: priceId })
              .eq('id', packageId);
          }
        } else {
          // Create a new price if none exists
          const pricingModel = packageData.pricing_model || 'per_user';
          const unitAmount = pricingModel === 'per_user'
            ? (billingInterval === 'month' ? (packageData.price_per_user_monthly || 0) : (packageData.price_per_user_yearly || 0))
            : (billingInterval === 'month' ? (packageData.base_price_monthly || 0) : (packageData.base_price_yearly || 0));

          const newPrice = await stripe.prices.create({
            product: packageData.stripe_product_id,
            unit_amount: Math.round(unitAmount * 100),
            currency: 'usd',
            recurring: {
              interval: billingInterval,
              usage_type: 'licensed', // Explicitly set to licensed for proper quantity support
            },
          });

          priceId = newPrice.id;
          const updateField = billingInterval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
          await supabase
            .from('packages')
            .update({ [updateField]: priceId })
            .eq('id', packageId);
        }
      } catch (error) {
        logger.error('[Stripe] Error fetching/creating prices from product:', error);
      }
    }

    if (!priceId) {
      logger.error('[Stripe] Package does not have a Stripe price ID for the selected interval and could not find/create one');
      return null;
    }

    const stripe = await getStripeClient();

    // Create or get customer
    let customerId = organization.stripe_customer_id;
    if (!customerId) {
      // Get organization owner email
      const { data: owner } = await supabase
        .from('users')
        .select('email, name')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (owner) {
        customerId = await createStripeCustomer(
          organizationId,
          owner.email,
          owner.name || 'Organization'
        );
      }
    }

    if (!customerId) {
      logger.error('[Stripe] Could not create or find customer');
      return null;
    }

    // Check price usage_type before creating checkout session
    // Metered prices don't support quantity parameter
    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch (priceError) {
      logger.error('[Stripe] Error retrieving price:', {
        priceId,
        error: priceError instanceof Error ? priceError.message : String(priceError),
      });
      return null;
    }

    const isMetered = price.recurring?.usage_type === 'metered';
    const pricingModel = packageData.pricing_model || 'per_user';

    // Build line_items conditionally based on usage_type
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
      price: priceId,
    }];

    // Only add quantity for licensed prices with per-user pricing
    // Metered prices don't support quantity at all
    if (!isMetered && pricingModel === 'per_user') {
      lineItems[0].quantity = 1; // Default to 1 for checkout sessions
    }
    // For metered or flat-rate licensed, omit quantity (defaults to 1)

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: organizationId,
        package_id: packageId,
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          package_id: packageId,
          billing_interval: billingInterval,
        },
      },
    });

    logger.debug('[Stripe] Created checkout session:', { sessionId: session.id, organizationId });
    return session.url || null;
  } catch (error) {
    logger.error('[Stripe] Error creating checkout session:', error);
    return null;
  }
}

/**
 * Create customer portal session
 */
export async function createPortalSession(
  organizationId: string,
  returnUrl: string
): Promise<string | null> {
  if (!(await isStripeConfigured())) {
    logger.warn('[Stripe] Stripe is not configured, skipping portal session creation');
    return null;
  }

  try {
    const supabase = createAdminSupabaseClient();

    // Get organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization?.stripe_customer_id) {
      logger.error('[Stripe] Organization or customer not found:', orgError);
      return null;
    }

    const stripe = await getStripeClient();

    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripe_customer_id,
      return_url: returnUrl,
    });

    logger.debug('[Stripe] Created portal session:', { sessionId: session.id, organizationId });
    return session.url;
  } catch (error) {
    logger.error('[Stripe] Error creating portal session:', error);
    return null;
  }
}

/**
 * Update subscription status from Stripe webhook
 */
export async function updateSubscriptionFromWebhook(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();

    // Find subscription by Stripe subscription ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, organization_id')
      .eq('stripe_subscription_id', stripeSubscription.id)
      .single();

    if (subError || !subscription) {
      logger.warn('[Stripe] Subscription not found in database:', stripeSubscription.id);
      return;
    }

    // Update subscription
    // Get package_id from subscription metadata if available
    const metadata = stripeSubscription.metadata;
    const packageIdFromMetadata = metadata?.package_id;
    
    // Build update object - preserve package_id if it exists, or set from metadata
    // Using Partial<SubscriptionRow> but we need to be careful with types that might not match exactly
    // (e.g. Supabase might expect string for dates, while we construct them here)
    // Local type intersection to handle potential missing types in Stripe SDK
    type StripeSubscriptionWithPeriod = Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
    };
    const sub = stripeSubscription as StripeSubscriptionWithPeriod;

    const updateData: Partial<SubscriptionRow> = {
      status: stripeSubscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
      current_period_start: sub.current_period_start 
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end 
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    };
    
    // Update package_id if provided in metadata and subscription doesn't have one
    if (packageIdFromMetadata) {
      // Verify package exists
      const { data: packageData } = await supabase
        .from('packages')
        .select('id')
        .eq('id', packageIdFromMetadata)
        .maybeSingle();
      
      if (packageData) {
        // Check current subscription to see if it has a package_id
        const { data: currentSub } = await supabase
          .from('subscriptions')
          .select('package_id')
          .eq('id', subscription.id)
          .single();
        
        // Only update package_id if it's missing or different
        if (!currentSub?.package_id || currentSub.package_id !== packageIdFromMetadata) {
          updateData.package_id = packageIdFromMetadata;
          logger.info('[Stripe] Updating subscription package_id from metadata:', {
            subscriptionId: subscription.id,
            packageId: packageIdFromMetadata,
          });
        }
      }
    }
    
    // Update stripe_price_id if available from subscription
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (priceId) {
      updateData.stripe_price_id = priceId;
    }
    
    // Extract billing_interval from Stripe price's recurring interval
    const price = stripeSubscription.items.data[0]?.price;
    if (price?.recurring?.interval) {
      const interval = price.recurring.interval;
      if (interval === 'month' || interval === 'year') {
        updateData.billing_interval = interval;
      }
    } else if (metadata?.billing_interval) {
      // Fall back to metadata if price doesn't have recurring info
      updateData.billing_interval = metadata.billing_interval;
    }
    
    await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription.id);

    // Update organization subscription status
    const orgStatus =
      stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing'
        ? 'active'
        : stripeSubscription.status === 'canceled'
        ? 'canceled'
        : 'past_due';

    await supabase
      .from('organizations')
      .update({
        subscription_status: orgStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.organization_id);

    logger.debug('[Stripe] Updated subscription from webhook:', {
      subscriptionId: subscription.id,
      status: stripeSubscription.status,
    });
  } catch (error) {
    logger.error('[Stripe] Error updating subscription from webhook:', error);
  }
}

