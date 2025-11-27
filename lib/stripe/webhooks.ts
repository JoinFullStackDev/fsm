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
  if (!(await isStripeConfigured())) {
    logger.warn('[Stripe] Stripe is not configured, cannot verify webhook');
    return null;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('[Stripe] STRIPE_WEBHOOK_SECRET is not set');
    return null;
  }

  try {
    const stripe = await getStripeClient();
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

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
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

    // IDEMPOTENCY: Check if subscription already exists by stripe_subscription_id
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, organization_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (existingSub) {
      // Update existing subscription
      logger.info('[Stripe Webhook] Updating existing subscription:', {
        subscriptionId: existingSub.id,
        stripeSubscriptionId: subscription.id,
      });
      await updateSubscriptionFromWebhook(subscription);
      return;
    }

    // Create new subscription - need to find organization
    const metadata = subscription.metadata;
    let organizationId = metadata?.organization_id;
    const packageId = metadata?.package_id;

    // If organization_id not in metadata, try to find by customer
    if (!organizationId) {
      const customerId = subscription.customer 
        ? (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id)
        : null;
      
      if (customerId) {
        const { data: orgByCustomer } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        
        if (orgByCustomer) {
          organizationId = orgByCustomer.id;
          logger.info('[Stripe Webhook] Found organization by customer ID:', {
            organizationId,
            customerId,
          });
        }
      }
    }

    // If still no organization_id and this is a signup, try to find by name
    if (!organizationId && metadata?.is_signup === 'true' && metadata?.organization_name) {
      const { data: orgByName } = await supabase
        .from('organizations')
        .select('id')
        .eq('name', metadata.organization_name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (orgByName) {
        organizationId = orgByName.id;
        logger.info('[Stripe Webhook] Found organization by name:', {
          organizationId,
          organizationName: metadata.organization_name,
        });
      }
    }

    if (!organizationId) {
      logger.warn('[Stripe Webhook] Cannot find organization for subscription:', {
        subscriptionId: subscription.id,
        metadata,
        customerId: subscription.customer 
          ? (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id)
          : null,
      });
      // Don't fail - callback will handle it when organization is created
      return;
    }

    // Verify organization exists
    const { data: orgCheck } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .single();

    if (!orgCheck) {
      logger.error('[Stripe Webhook] Organization not found:', organizationId);
      return;
    }

    if (!packageId) {
      logger.error('[Stripe Webhook] Missing package_id in subscription metadata:', subscription.id);
      return;
    }

    // Get package to verify it exists
    const { data: packageData } = await supabase
      .from('packages')
      .select('id')
      .eq('id', packageId)
      .single();

    if (!packageData) {
      logger.error('[Stripe Webhook] Package not found:', packageId);
      return;
    }

    const subscriptionData = subscription as any; // Type assertion for Stripe API compatibility
    
    // Get customer ID from subscription
    const customerId = subscription.customer 
      ? (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id)
      : null;

    // IDEMPOTENCY: Check one more time if subscription was created between checks
    const { data: doubleCheckSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (doubleCheckSub) {
      logger.info('[Stripe Webhook] Subscription was created between checks, updating:', {
        subscriptionId: doubleCheckSub.id,
      });
      await updateSubscriptionFromWebhook(subscription);
      return;
    }

    // Create subscription
    const { error: insertError } = await supabase.from('subscriptions').insert({
      organization_id: organizationId,
      package_id: packageData.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id || null,
      status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
      current_period_start: subscriptionData.current_period_start 
        ? new Date(subscriptionData.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscriptionData.current_period_end 
        ? new Date(subscriptionData.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
    });

    if (insertError) {
      // If it's a unique constraint violation, subscription already exists
      if (insertError.code === '23505') {
        logger.info('[Stripe Webhook] Subscription already exists (race condition), updating:', {
          stripeSubscriptionId: subscription.id,
        });
        await updateSubscriptionFromWebhook(subscription);
        return;
      }
      logger.error('[Stripe Webhook] Error creating subscription:', insertError);
      return;
    }

    // Update organization subscription status and customer ID
    const orgStatus =
      subscription.status === 'active' || subscription.status === 'trialing'
        ? 'active'
        : subscription.status === 'canceled'
        ? 'canceled'
        : 'past_due';

    const orgUpdate: any = {
      subscription_status: orgStatus,
      updated_at: new Date().toISOString(),
    };

    // Update customer ID if available and not already set
    if (customerId) {
      // Check if customer_id is already set to avoid unnecessary update
      const { data: currentOrg } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (!currentOrg?.stripe_customer_id) {
        orgUpdate.stripe_customer_id = customerId;
      }
    }

    await supabase
      .from('organizations')
      .update(orgUpdate)
      .eq('id', organizationId);

    logger.info('[Stripe Webhook] Created subscription from webhook:', {
      subscriptionId: subscription.id,
      organizationId,
      status: subscription.status,
    });
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
    const invoiceData = invoice as any; // Type assertion for Stripe API compatibility
    if (invoiceData.subscription) {
      const subscriptionId =
        typeof invoiceData.subscription === 'string'
          ? invoiceData.subscription
          : invoiceData.subscription.id;

      const stripe = await getStripeClient();
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
    const invoiceData = invoice as any; // Type assertion for Stripe API compatibility
    if (invoiceData.subscription) {
      const subscriptionId =
        typeof invoiceData.subscription === 'string'
          ? invoiceData.subscription
          : invoiceData.subscription.id;

      const stripe = await getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateSubscriptionFromWebhook(subscription);
    }

    logger.debug('[Stripe] Invoice payment failed:', invoice.id);
  } catch (error) {
    logger.error('[Stripe] Error handling invoice payment failed:', error);
  }
}

/**
 * Handle checkout session completed
 * This fires when a customer completes checkout, updating organization to active
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    const metadata = session.metadata;
    
    // For signup flow, organization might not exist yet or might be identified by name
    let organizationId = metadata?.organization_id;
    
    // If this is a signup and we don't have organization_id, try to find by name
    if (!organizationId && metadata?.is_signup === 'true' && metadata?.organization_name) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('name', metadata.organization_name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (org) {
        organizationId = org.id;
      } else {
        logger.warn('[Stripe] Checkout session completed for signup but organization not found:', {
          sessionId: session.id,
          organizationName: metadata.organization_name,
        });
        // Organization might not be created yet - callback will handle it
        return;
      }
    }

    if (!organizationId) {
      logger.warn('[Stripe] Checkout session completed but no organization_id in metadata:', session.id);
      return;
    }

    // Verify organization exists
    const { data: orgCheck } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id, subscription_status')
      .eq('id', organizationId)
      .single();

    if (!orgCheck) {
      logger.warn('[Stripe] Organization not found for checkout session:', {
        sessionId: session.id,
        organizationId,
      });
      return;
    }

    // Update organization with Stripe customer ID if available and not already set
    const customerId = session.customer 
      ? (typeof session.customer === 'string' ? session.customer : session.customer.id)
      : null;
    
    if (customerId && !orgCheck.stripe_customer_id) {
      await supabase
        .from('organizations')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);
      
      logger.info('[Stripe] Updated organization with customer ID:', {
        organizationId,
        customerId,
      });
    }

    // If there's a subscription, it will be handled by subscription webhooks
    // But we can also update the organization status here for immediate effect
    // Only update if not already active to avoid race conditions
    if (session.subscription) {
      const stripe = await getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      );
      
      // Only update if status is not already active (prevent overwriting)
      if (orgCheck.subscription_status !== 'active') {
        await supabase
          .from('organizations')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', organizationId);

        logger.info('[Stripe] Checkout session completed, updated organization to active:', {
          sessionId: session.id,
          organizationId,
          subscriptionId: subscription.id,
          customerId,
        });
      } else {
        logger.debug('[Stripe] Checkout session completed, organization already active:', {
          sessionId: session.id,
          organizationId,
        });
      }
    } else if (session.payment_status === 'paid' && orgCheck.subscription_status !== 'active') {
      // One-time payment completed
      await supabase
        .from('organizations')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

      logger.info('[Stripe] Checkout session completed (one-time payment), updated organization to active:', {
        sessionId: session.id,
        organizationId,
        customerId,
      });
    }
  } catch (error) {
    logger.error('[Stripe] Error handling checkout session completed:', error);
  }
}

