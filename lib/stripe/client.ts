/**
 * Stripe client initialization
 * Note: Install stripe package with: npm install stripe
 */

import Stripe from 'stripe';
import logger from '@/lib/utils/logger';

let stripeInstance: Stripe | null = null;

/**
 * Get or create Stripe client instance
 */
export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    logger.error('[Stripe] STRIPE_SECRET_KEY environment variable is not set');
    throw new Error('Stripe secret key is not configured');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });

  return stripeInstance;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

