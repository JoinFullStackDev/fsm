import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe/client';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/get-checkout-session
 * Get checkout session details (for signup callback)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return badRequest('Missing session_id parameter');
    }

    const stripe = await getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    // Get subscription details if it exists
    let subscriptionDetails = null;
    if (session.subscription) {
      const subscriptionId = typeof session.subscription === 'string' 
        ? session.subscription 
        : session.subscription.id;
      subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
    }

    return NextResponse.json({
      session_id: session.id,
      subscription_id: session.subscription 
        ? (typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
        : null,
      customer_id: session.customer 
        ? (typeof session.customer === 'string' ? session.customer : session.customer.id)
        : null,
      payment_status: session.payment_status,
      subscription: subscriptionDetails ? {
        id: subscriptionDetails.id,
        status: subscriptionDetails.status,
        current_period_start: (subscriptionDetails as any).current_period_start,
        current_period_end: (subscriptionDetails as any).current_period_end,
        customer: subscriptionDetails.customer,
      } : null,
    });
  } catch (error) {
    logger.error('Error in GET /api/stripe/get-checkout-session:', error);
    return internalError('Failed to get checkout session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

