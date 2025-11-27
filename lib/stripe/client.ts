/**
 * Stripe client initialization
 * Note: Install stripe package with: npm install stripe
 */

import Stripe from 'stripe';
import logger from '@/lib/utils/logger';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';

let stripeInstance: Stripe | null = null;
let stripeSecretKey: string | null = null;

/**
 * Get Stripe secret key from database
 */
export async function getStripeSecretKey(mode: 'test' | 'live' = 'test'): Promise<string | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    const { data: connection, error } = await adminClient
      .from('system_connections')
      .select('config, test_mode, is_active')
      .eq('connection_type', 'stripe')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn('[Stripe] Stripe connection not found in database. Please configure Stripe keys in System Settings.');
      } else {
        logger.error('[Stripe] Error fetching Stripe connection from database:', error);
      }
      return null;
    }

    if (!connection) {
      logger.warn('[Stripe] Stripe connection not found in database');
      return null;
    }

    const config = connection.config || {};
    const useTestMode = connection.test_mode !== false; // Default to test mode
    
    // Determine which key to use
    const effectiveMode = mode === 'live' ? 'live' : (useTestMode ? 'test' : 'live');
    // Support both camelCase and snake_case key names (prioritize snake_case as that's what's saved)
    const secretKey = effectiveMode === 'live' 
      ? config.live_secret_key || config.liveSecretKey
      : config.test_secret_key || config.testSecretKey;

    if (!secretKey) {
      logger.warn(`[Stripe] ${effectiveMode} secret key not configured in database. Connection active: ${connection.is_active}, test_mode: ${connection.test_mode}, config keys: ${Object.keys(config).join(', ')}`);
      return null;
    }

    // Log warning if connection is not active, but still return the key
    if (!connection.is_active) {
      logger.warn('[Stripe] Using Stripe keys from inactive connection. Consider activating the connection in System Settings.');
    }

    return secretKey;
  } catch (error) {
    logger.error('[Stripe] Error fetching Stripe keys from database:', error);
    return null;
  }
}

/**
 * Get or create Stripe client instance (uses database keys)
 * This is async now since we need to fetch from database
 */
export async function getStripeClient(mode: 'test' | 'live' = 'test'): Promise<Stripe> {
  const secretKey = await getStripeSecretKey(mode);
  
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured');
  }

  // Return cached instance if same key
  if (stripeInstance && stripeSecretKey === secretKey) {
    return stripeInstance;
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
    typescript: true,
  });

  stripeSecretKey = secretKey;
  return stripeInstance;
}

/**
 * Check if Stripe is configured (checks database)
 */
export async function isStripeConfigured(mode: 'test' | 'live' = 'test'): Promise<boolean> {
  try {
    const secretKey = await getStripeSecretKey(mode);
    if (!secretKey) {
      // Log additional debug info
      const adminClient = createAdminSupabaseClient();
      const { data: connection } = await adminClient
        .from('system_connections')
        .select('config, test_mode, is_active')
        .eq('connection_type', 'stripe')
        .maybeSingle();
      
      if (!connection) {
        logger.debug('[Stripe] No Stripe connection found in database');
      } else {
        logger.debug('[Stripe] Connection found but no valid key:', {
          is_active: connection.is_active,
          test_mode: connection.test_mode,
          has_test_key: !!(connection.config?.test_secret_key || connection.config?.testSecretKey),
          has_live_key: !!(connection.config?.live_secret_key || connection.config?.liveSecretKey),
        });
      }
    }
    return !!secretKey;
  } catch (error) {
    logger.error('[Stripe] Error checking if Stripe is configured:', error);
    return false;
  }
}

/**
 * Get Stripe client synchronously (for backward compatibility)
 * Falls back to environment variable if database doesn't have keys
 * @deprecated Use getStripeClient() instead
 */
export function getStripeClientSync(): Stripe {
  if (stripeInstance && stripeSecretKey) {
    return stripeInstance;
  }

  // Fallback to environment variable for backward compatibility
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    logger.error('[Stripe] STRIPE_SECRET_KEY environment variable is not set');
    throw new Error('Stripe secret key is not configured');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
    typescript: true,
  });

  stripeSecretKey = secretKey;
  return stripeInstance;
}
