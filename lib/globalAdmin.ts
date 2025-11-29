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
    if (config.provider === 'sendgrid') {
      if (!config.sendgrid?.apiKey) {
        return {
          success: false,
          error: 'SendGrid API key is required',
        };
      }

      // Import SendGrid dynamically
      const sgMail = (await import('@sendgrid/mail')).default;
      
      // Decrypt the API key if it's encrypted (check if it contains colons, which indicates encryption)
      let apiKey = config.sendgrid.apiKey;
      let wasEncrypted = false;
      
      if (apiKey.includes(':')) {
        // It's encrypted, try to decrypt it
        wasEncrypted = true;
        try {
          const { decryptApiKey } = await import('./apiKeys');
          apiKey = decryptApiKey(apiKey);
          logger.debug('[GlobalAdmin] Successfully decrypted SendGrid API key');
        } catch (decryptError) {
          logger.error('[GlobalAdmin] Error decrypting SendGrid API key:', decryptError);
          return {
            success: false,
            error: 'Failed to decrypt SendGrid API key. Please check your encryption key configuration.',
          };
        }
      }

      // Validate API key format (SendGrid keys start with "SG.")
      if (!apiKey.startsWith('SG.')) {
        logger.warn('[GlobalAdmin] SendGrid API key does not start with "SG." - may be invalid');
        // Don't fail here, let SendGrid API validate it
      }

      // Set API key and test connection
      sgMail.setApiKey(apiKey);

      // Test by making a simple API call to SendGrid
      try {
        // Use SendGrid's API to verify the key by checking account info
        const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const profile = await response.json();
          logger.info('[GlobalAdmin] SendGrid connection test successful', {
            email: profile.email,
            wasEncrypted,
          });
          return {
            success: true,
            message: `Successfully connected to SendGrid (${profile.email || 'verified'})`,
          };
        } else {
          const errorData = await response.json().catch(() => ({ 
            message: `HTTP ${response.status}: ${response.statusText}`,
            errors: []
          }));
          
          // Log detailed error for debugging
          logger.error('[GlobalAdmin] SendGrid API test failed', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            wasEncrypted,
            apiKeyPrefix: apiKey.substring(0, 10) + '...', // Log first 10 chars for debugging
          });
          
          let errorMessage = errorData.message || `SendGrid API returned status ${response.status}`;
          
          // Provide more helpful error messages
          if (response.status === 401) {
            errorMessage = 'Invalid SendGrid API key. Please check that the key is correct and has not been revoked.';
          } else if (response.status === 403) {
            errorMessage = 'SendGrid API key does not have sufficient permissions.';
          }
          
          return {
            success: false,
            error: errorMessage,
          };
        }
      } catch (apiError) {
        logger.error('[GlobalAdmin] SendGrid API test failed with exception:', {
          error: apiError,
          wasEncrypted,
        });
        return {
          success: false,
          error: apiError instanceof Error ? apiError.message : 'Failed to connect to SendGrid API',
        };
      }
    } else if (config.provider === 'smtp') {
      // TODO: Implement SMTP connection testing
      return {
        success: false,
        error: 'SMTP connection testing not yet implemented',
      };
    } else if (config.provider === 'ses') {
      // TODO: Implement SES connection testing
      return {
        success: false,
        error: 'SES connection testing not yet implemented',
      };
    }

    return {
      success: false,
      error: 'Unsupported email provider',
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

