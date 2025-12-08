/**
 * Admin subscription update utilities
 * Separate flow for updating subscriptions when company admins add/remove users
 * This is kept separate from the main subscription flow to maintain stability
 */

import { getStripeClient, isStripeConfigured } from './client';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getOrganizationUsage, getOrganizationContextById } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';
import type Stripe from 'stripe';

/**
 * Update Stripe subscription quantity based on current user count
 * Only updates if package uses per-user pricing model
 */
export async function updateSubscriptionQuantityForUsers(
  organizationId: string
): Promise<{ success: boolean; error?: string; newQuantity?: number }> {
  try {
    if (!(await isStripeConfigured())) {
      logger.warn('[AdminSubscriptionUpdates] Stripe is not configured, skipping subscription update');
      return { success: false, error: 'Stripe is not configured' };
    }

    const adminClient = createAdminSupabaseClient();

    // Get organization context to check package pricing model
    const context = await getOrganizationContextById(adminClient, organizationId);
    if (!context || !context.package) {
      logger.warn('[AdminSubscriptionUpdates] No active subscription or package found');
      return { success: false, error: 'No active subscription found' };
    }

    // Only update if package uses per-user pricing
    if (context.package.pricing_model !== 'per_user') {
      logger.info('[AdminSubscriptionUpdates] Package does not use per-user pricing, skipping update');
      return { success: true, newQuantity: undefined }; // Not an error, just not applicable
    }

    // Get current subscription
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, stripe_subscription_id, billing_interval')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription || !subscription.stripe_subscription_id) {
      logger.warn('[AdminSubscriptionUpdates] No active subscription with Stripe ID found');
      return { success: false, error: 'No active Stripe subscription found' };
    }

    // Get current user count
    const usage = await getOrganizationUsage(adminClient, organizationId);
    const newQuantity = usage.users;

    if (newQuantity < 1) {
      logger.warn('[AdminSubscriptionUpdates] User count is less than 1, setting to 1');
      // Stripe requires quantity to be at least 1
      return { success: false, error: 'User count must be at least 1' };
    }

    // Update Stripe subscription
    const stripe = await getStripeClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    // Find the subscription item for this price
    const subscriptionItem = stripeSubscription.items.data[0];
    if (!subscriptionItem) {
      logger.error('[AdminSubscriptionUpdates] No subscription items found');
      return { success: false, error: 'No subscription items found' };
    }

    // Update the subscription item quantity
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItem.id,
          quantity: newQuantity,
        },
      ],
      proration_behavior: 'always_invoice',
    });

    logger.info('[AdminSubscriptionUpdates] Successfully updated subscription quantity', {
      organizationId,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      newQuantity,
      billingInterval: subscription.billing_interval,
    });

    return { success: true, newQuantity };
  } catch (error) {
    logger.error('[AdminSubscriptionUpdates] Error updating subscription quantity:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating subscription',
    };
  }
}

/**
 * Get subscription details including user count and pricing
 */
export async function getSubscriptionWithUserDetails(
  organizationId: string
): Promise<{
  subscription: unknown;
  userCount: number;
  perUserPrice: number | null;
  totalPrice: number | null;
  billingInterval: 'month' | 'year' | null;
  pricingModel: 'per_user' | 'flat_rate' | null;
} | null> {
  try {
    const adminClient = createAdminSupabaseClient();

    // Get organization context
    const context = await getOrganizationContextById(adminClient, organizationId);
    if (!context || !context.subscription || !context.package) {
      return null;
    }

    // Get user count
    const usage = await getOrganizationUsage(adminClient, organizationId);
    const userCount = usage.users;

    // Get pricing details
    const packageData = context.package;
    const billingInterval = context.subscription.billing_interval || 'month';
    const pricingModel = packageData.pricing_model || 'per_user';

    let perUserPrice: number | null = null;
    let totalPrice: number | null = null;

    if (pricingModel === 'per_user') {
      perUserPrice =
        billingInterval === 'month'
          ? packageData.price_per_user_monthly
          : packageData.price_per_user_yearly;
      totalPrice = perUserPrice ? perUserPrice * userCount : null;
    } else {
      totalPrice =
        billingInterval === 'month'
          ? packageData.base_price_monthly
          : packageData.base_price_yearly;
    }

    return {
      subscription: context.subscription,
      userCount,
      perUserPrice,
      totalPrice,
      billingInterval,
      pricingModel,
    };
  } catch (error) {
    logger.error('[AdminSubscriptionUpdates] Error getting subscription details:', error);
    return null;
  }
}
