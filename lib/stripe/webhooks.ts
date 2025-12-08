/**
 * Stripe webhook handlers
 */

import { getStripeClient, isStripeConfigured } from './client';
import { updateSubscriptionFromWebhook } from './subscriptions';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { isEmailConfigured, sendEmailWithRetry } from '@/lib/emailService';
import { getPostPaymentWelcomeTemplate } from '@/lib/emailTemplates';
import logger from '@/lib/utils/logger';
import type Stripe from 'stripe';
import type { OrganizationRow } from '@/types/database';

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
    let organizationId: string | null | undefined = metadata?.organization_id;
    const packageId = metadata?.package_id;
    const isSignup = metadata?.is_signup === 'true';

    // PRIORITY 1: Use organization_id from metadata (most reliable for signups)
    if (organizationId) {
      // Validate organization exists
      const { data: orgCheck } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .maybeSingle();
      
      if (orgCheck) {
        logger.info('[Stripe Webhook] Using organization_id from metadata:', {
          organizationId,
          organizationName: orgCheck.name,
        });
      } else {
        logger.warn('[Stripe Webhook] organization_id from metadata not found in database:', {
          organizationId,
          subscriptionId: subscription.id,
        });
        organizationId = null; // Reset to try other methods
      }
    }

    // PRIORITY 2: If organization_id not in metadata or invalid, try to find by customer
    if (!organizationId) {
      const customerId = subscription.customer 
        ? (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id)
        : null;
      
      if (customerId) {
        const { data: orgByCustomer } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        
        if (orgByCustomer) {
          organizationId = orgByCustomer.id;
          logger.info('[Stripe Webhook] Found organization by customer ID:', {
            organizationId,
            organizationName: orgByCustomer.name,
            customerId,
          });
        }
      }
    }

    // PRIORITY 3: If still no organization_id and this is a signup, try to find by name
    // NOTE: This is less reliable as organization names may not be unique
    if (!organizationId && isSignup && metadata?.organization_name) {
      const { data: orgByName } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('name', metadata.organization_name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (orgByName) {
        organizationId = orgByName.id;
        logger.info('[Stripe Webhook] Found organization by name (fallback):', {
          organizationId,
          organizationName: orgByName.name,
        });
      }
    }

    // If still no organization_id and this is a signup, skip webhook creation
    // Let signup-callback handle it when organization is created
    if (!organizationId && isSignup) {
      logger.info('[Stripe Webhook] Skipping subscription creation for signup - organization not found yet. Signup-callback will handle it:', {
        subscriptionId: subscription.id,
        metadata,
        customerId: subscription.customer 
          ? (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id)
          : null,
      });
      // Don't fail - signup-callback will create subscription when organization is ready
      return;
    }

    // If not a signup and no organization found, log warning but don't create subscription
    if (!organizationId) {
      logger.warn('[Stripe Webhook] Cannot find organization for subscription:', {
        subscriptionId: subscription.id,
        metadata,
        isSignup,
        customerId: subscription.customer 
          ? (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id)
          : null,
      });
      // Don't fail - may be handled elsewhere
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

    // Extract billing_interval from Stripe price's recurring interval or metadata
    let billingInterval: 'month' | 'year' | null = null;
    const price = subscription.items.data[0]?.price;
    if (price?.recurring?.interval) {
      const interval = price.recurring.interval;
      if (interval === 'month' || interval === 'year') {
        billingInterval = interval;
      }
    } else if (metadata?.billing_interval) {
      billingInterval = metadata.billing_interval as 'month' | 'year';
    } else {
      // Default to 'month' for backward compatibility
      billingInterval = 'month';
    }

    // Create subscription
    const { error: insertError } = await supabase.from('subscriptions').insert({
      organization_id: organizationId,
      package_id: packageData.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id || null,
      billing_interval: billingInterval,
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

    const orgUpdate: Partial<OrganizationRow> = {
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
    let organizationId: string | null | undefined = metadata?.organization_id;
    
    // If this is a signup and we don't have organization_id, try to find by name (with retries)
    if (!organizationId && metadata?.is_signup === 'true' && metadata?.organization_name) {
      const maxRetries = 3;
      let foundOrg = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s
          const delay = 1000 * attempt;
          logger.info('[Stripe] Retrying organization lookup by name (attempt ' + (attempt + 1) + '):', {
            delay,
            sessionId: session.id,
            organizationName: metadata.organization_name,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('name', metadata.organization_name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (org) {
          foundOrg = org;
          organizationId = org.id;
          logger.info('[Stripe] Found organization by name:', {
            sessionId: session.id,
            organizationId: org.id,
            organizationName: metadata.organization_name,
            attempt: attempt + 1,
          });
          break;
        } else if (orgError && orgError.code !== 'PGRST116') {
          // Real error (not just "not found")
          logger.error('[Stripe] Error looking up organization by name:', {
            error: orgError.message,
            sessionId: session.id,
            organizationName: metadata.organization_name,
            attempt: attempt + 1,
          });
        }
      }
      
      if (!foundOrg) {
        logger.warn('[Stripe] Checkout session completed for signup but organization not found after retries:', {
          sessionId: session.id,
          organizationName: metadata.organization_name,
          maxRetries,
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

    // Update organization with Stripe customer ID if available
    // Always update if customer ID is different (handles race conditions)
    const customerId = session.customer 
      ? (typeof session.customer === 'string' ? session.customer : session.customer.id)
      : null;
    
    if (customerId) {
      // Update even if already set (handles race conditions and ensures consistency)
      if (orgCheck.stripe_customer_id !== customerId) {
        const { error: customerUpdateError } = await supabase
          .from('organizations')
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', organizationId);
        
        if (customerUpdateError) {
          logger.error('[Stripe] Error updating organization with customer ID:', {
            error: customerUpdateError.message,
            organizationId,
            customerId,
            sessionId: session.id,
          });
        } else {
          logger.info('[Stripe] Updated organization with customer ID:', {
            organizationId,
            customerId,
            previousCustomerId: orgCheck.stripe_customer_id || null,
            sessionId: session.id,
          });
        }
      } else {
        logger.debug('[Stripe] Customer ID already set to correct value (idempotent):', {
          organizationId,
          customerId,
          sessionId: session.id,
        });
      }
    } else {
      logger.warn('[Stripe] Checkout session completed but no customer ID in session:', {
        sessionId: session.id,
        organizationId,
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

    // Send welcome email after payment (for signup flow)
    if (metadata?.is_signup === 'true' && metadata?.signup_email) {
      try {
        const emailConfigured = await isEmailConfigured();
        if (emailConfigured) {
          // Get organization and package details
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', organizationId)
            .single();

          const { data: subscriptionData } = await supabase
            .from('subscriptions')
            .select('package_id, billing_interval')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let packageName = 'Your Selected Plan';
          if (subscriptionData?.package_id) {
            const { data: pkgData } = await supabase
              .from('packages')
              .select('name')
              .eq('id', subscriptionData.package_id)
              .single();
            if (pkgData) {
              packageName = pkgData.name;
            }
          }

          // Get base URL for login link
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const loginLink = `${baseUrl}/auth/signin`;

          // Note: Supabase handles email confirmation automatically
          // We can't easily get the confirmation link, but we can mention it in the email
          const template = await getPostPaymentWelcomeTemplate(
            metadata.signup_name || metadata.signup_email.split('@')[0],
            orgData?.name || metadata.organization_name || 'Your Organization',
            packageName,
            loginLink,
            undefined, // emailConfirmationLink
            organizationId || null
          );

          const emailResult = await sendEmailWithRetry(
            metadata.signup_email,
            template.subject,
            template.html,
            template.text,
            undefined,
            undefined,
            organizationId || null
          );

          if (emailResult.success) {
            logger.info('[Stripe] Post-payment welcome email sent successfully', {
              email: metadata.signup_email,
              organizationId,
              subject: template.subject,
            });
          } else {
            logger.error('[Stripe] Failed to send post-payment welcome email:', {
              email: metadata.signup_email,
              organizationId,
              error: emailResult.error,
              subject: template.subject,
            });
          }
        } else {
          logger.warn('[Stripe] Email not configured, skipping post-payment welcome email', {
            email: metadata.signup_email,
            organizationId,
          });
        }
      } catch (emailError) {
        // Don't fail webhook if email fails, but log the error
        logger.error('[Stripe] Error in post-payment email flow:', {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          email: metadata.signup_email,
          organizationId,
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });
      }
    }
  } catch (error) {
    logger.error('[Stripe] Error handling checkout session completed:', error);
  }
}

