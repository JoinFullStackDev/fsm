/**
 * Stripe webhook handlers
 */

import { getStripeClient, isStripeConfigured } from './client';
import { updateSubscriptionFromWebhook } from './subscriptions';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type Stripe from 'stripe';

/**
 * Verify and parse Stripe webhook event
 */
export async function verifyWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event | null> {
  if (!isStripeConfigured()) {
    logger.warn('[Stripe] Stripe is not configured, cannot verify webhook');
    return null;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('[Stripe] STRIPE_WEBHOOK_SECRET is not set');
    return null;
  }

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return event;
  } catch (error) {
    logger.error('[Stripe] Webhook verification failed:', error);
    return null;
  }
}

/**
 * Handle Stripe webhook event
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.debug('[Stripe] Unhandled webhook event type:', event.type);
    }
  } catch (error) {
    logger.error('[Stripe] Error handling webhook event:', error);
  }
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();

    // Check if subscription already exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (existingSub) {
      // Update existing subscription
      await updateSubscriptionFromWebhook(subscription);
    } else {
      // Create new subscription
      const metadata = subscription.metadata;
      const organizationId = metadata?.organization_id;
      const packageId = metadata?.package_id;

      if (!organizationId || !packageId) {
        logger.error('[Stripe] Missing metadata in subscription:', subscription.id);
        return;
      }

      // Get package to find package_id
      const { data: packageData } = await supabase
        .from('packages')
        .select('id')
        .eq('id', packageId)
        .single();

      if (!packageData) {
        logger.error('[Stripe] Package not found:', packageId);
        return;
      }

      await supabase.from('subscriptions').insert({
        organization_id: organizationId,
        package_id: packageData.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price.id || null,
        status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end || false,
      });

      // Update organization subscription status
      const orgStatus =
        subscription.status === 'active' || subscription.status === 'trialing'
          ? 'active'
          : subscription.status === 'canceled'
          ? 'canceled'
          : 'past_due';

      await supabase
        .from('organizations')
        .update({
          subscription_status: orgStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

      logger.debug('[Stripe] Created subscription from webhook:', {
        subscriptionId: subscription.id,
        organizationId,
      });
    }
  } catch (error) {
    logger.error('[Stripe] Error handling subscription updated:', error);
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  try {
    await updateSubscriptionFromWebhook(subscription);
    logger.debug('[Stripe] Subscription deleted:', subscription.id);
  } catch (error) {
    logger.error('[Stripe] Error handling subscription deleted:', error);
  }
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  try {
    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id;

      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateSubscriptionFromWebhook(subscription);
    }

    logger.debug('[Stripe] Invoice payment succeeded:', invoice.id);
  } catch (error) {
    logger.error('[Stripe] Error handling invoice payment succeeded:', error);
  }
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  try {
    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id;

      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateSubscriptionFromWebhook(subscription);
    }

    logger.debug('[Stripe] Invoice payment failed:', invoice.id);
  } catch (error) {
    logger.error('[Stripe] Error handling invoice payment failed:', error);
  }
}

