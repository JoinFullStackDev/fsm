import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookEvent, handleWebhookEvent } from '@/lib/stripe/webhooks';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    // Verify webhook event
    const event = await verifyWebhookEvent(body, signature);
    if (!event) {
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
    }

    // Handle webhook event
    await handleWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Error in POST /api/stripe/webhook:', error);
    return internalError('Failed to process webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

