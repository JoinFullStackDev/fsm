import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe/client';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/get-subscription
 * Get full subscription details from Stripe
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subscriptionId = searchParams.get('subscription_id');

    if (!subscriptionId) {
      return badRequest('Missing subscription_id parameter');
    }

    const stripe = await getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });

    const subscriptionData = subscription as any; // Type assertion for Stripe API compatibility
    
    return NextResponse.json({
      id: subscription.id,
      status: subscription.status,
      customer: subscription.customer,
      current_period_start: subscriptionData.current_period_start,
      current_period_end: subscriptionData.current_period_end,
      cancel_at_period_end: subscriptionData.cancel_at_period_end,
      items: subscription.items.data.map((item) => ({
        id: item.id,
        price: {
          id: item.price.id,
          unit_amount: item.price.unit_amount,
          currency: item.price.currency,
          recurring: item.price.recurring,
        },
      })),
    });
  } catch (error) {
    logger.error('Error in GET /api/stripe/get-subscription:', error);
    return internalError('Failed to get subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

