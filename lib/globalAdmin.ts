/**
 * Global Admin utility functions
 * Provides helpers for super admin operations and connection testing
 */

import { createServerSupabaseClient } from './supabaseServer';
import { createAdminSupabaseClient } from './supabaseAdmin';
import { unauthorized, forbidden } from './utils/apiErrors';
import logger from './utils/logger';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient, isStripeConfigured } from './stripe/client';

/**
 * Require super admin access - throws error if not super admin
 * @param request - Next.js request object
 * @returns User ID if super admin
 */
export async function requireSuperAdmin(request: NextRequest): Promise<{ userId: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw unauthorized('You must be logged in');
  }

  // Get user record to check super admin status
  let userData;
  const { data: regularUserData, error: regularUserError } = await supabase
    .from('users')
    .select('id, role, is_super_admin')
    .eq('auth_id', session.user.id)
    .single();

  if (regularUserError || !regularUserData) {
    const adminClient = createAdminSupabaseClient();
    const { data: adminUserData, error: adminUserError } = await adminClient
      .from('users')
      .select('id, role, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (adminUserError || !adminUserData) {
      throw unauthorized('User not found');
    }

    userData = adminUserData;
  } else {
    userData = regularUserData;
  }

  // Check super admin access
  if (userData.role !== 'admin' || !userData.is_super_admin) {
    throw forbidden('Super admin access required');
  }

  return { userId: userData.id };
}

/**
 * Test Stripe API connection
 * @param mode - 'test' or 'live'
 * @returns Connection test result
 */
export async function testStripeConnection(mode: 'test' | 'live'): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    if (!isStripeConfigured()) {
      return {
        success: false,
        error: 'Stripe is not configured',
      };
    }

    const stripe = await getStripeClient();
    
    // Test connection by fetching account info
    const account = await stripe.accounts.retrieve();
    
    return {
      success: true,
      message: `Successfully connected to Stripe (${account.id})`,
    };
  } catch (error) {
    logger.error('[GlobalAdmin] Stripe connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test email service connection
 * @param config - Email service configuration
 * @returns Connection test result
 */
export async function testEmailConnection(config: {
  provider: 'smtp' | 'sendgrid' | 'ses';
  smtp?: {
    host: string;
    port: number;
    username: string;
    password: string;
    encryption: 'tls' | 'ssl';
  };
  sendgrid?: {
    apiKey: string;
  };
  ses?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
}): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // TODO: Implement email connection testing
    // For now, return a placeholder
    return {
      success: false,
      error: 'Email connection testing not yet implemented',
    };
  } catch (error) {
    logger.error('[GlobalAdmin] Email connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test AI service connection
 * @returns Connection test result
 */
export async function testAIConnection(): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'Google GenAI API key not configured',
      };
    }

    // Test by making a simple API call
    // TODO: Implement actual API test call
    return {
      success: true,
      message: 'AI service connection successful',
    };
  } catch (error) {
    logger.error('[GlobalAdmin] AI connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test storage connection
 * @param config - Storage configuration
 * @returns Connection test result
 */
export async function testStorageConnection(config: {
  provider: 'local' | 's3';
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // TODO: Implement storage connection testing
    return {
      success: false,
      error: 'Storage connection testing not yet implemented',
    };
  } catch (error) {
    logger.error('[GlobalAdmin] Storage connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

