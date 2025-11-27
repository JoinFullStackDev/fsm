/**
 * Stripe subscription management utilities
 */

import { getStripeClient, isStripeConfigured } from './client';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type Stripe from 'stripe';

/**
 * Create a Stripe customer for an organization
 */
export async function createStripeCustomer(
  organizationId: string,
  email: string,
  name: string
): Promise<string | null> {
  if (!isStripeConfigured()) {
    logger.warn('[Stripe] Stripe is not configured, skipping customer creation');
    return null;
  }

  try {
    const stripe = getStripeClient();
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
  cancelUrl: string
): Promise<string | null> {
  if (!isStripeConfigured()) {
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
      .select('id, stripe_price_id, price_per_user_monthly')
      .eq('id', packageId)
      .single();

    if (pkgError || !packageData) {
      logger.error('[Stripe] Package not found:', pkgError);
      return null;
    }

    if (!packageData.stripe_price_id) {
      logger.error('[Stripe] Package does not have a Stripe price ID');
      return null;
    }

    const stripe = getStripeClient();

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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: packageData.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: organizationId,
        package_id: packageId,
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
  if (!isStripeConfigured()) {
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

    const stripe = getStripeClient();

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
    const subscriptionData = stripeSubscription as any; // Type assertion for Stripe API compatibility
    await supabase
      .from('subscriptions')
      .update({
        status: stripeSubscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
        current_period_start: subscriptionData.current_period_start 
          ? new Date(subscriptionData.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscriptionData.current_period_end 
          ? new Date(subscriptionData.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      })
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

