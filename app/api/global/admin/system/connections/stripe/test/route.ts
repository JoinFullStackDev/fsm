import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { decryptApiKey } from '@/lib/apiKeys';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import Stripe from 'stripe';

/**
 * Check if a value looks like an encrypted key (format: iv:authTag:data)
 */
function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}

/**
 * Decrypt key if encrypted, otherwise return as-is (for backward compatibility)
 */
function decryptIfNeeded(key: string): string {
  if (isEncrypted(key)) {
    try {
      return decryptApiKey(key);
    } catch (error) {
      logger.error('[Stripe Test] Failed to decrypt key:', error);
      throw new Error('Failed to decrypt stored key');
    }
  }
  return key;
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/global/admin/system/connections/stripe/test
 * Test Stripe connection (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();
    const mode = body.mode || 'test';

    // Get Stripe connection from database
    const { data: connection, error: fetchError } = await adminClient
      .from('system_connections')
      .select('*')
      .eq('connection_type', 'stripe')
      .single();

    if (fetchError || !connection) {
      return badRequest('Stripe connection not configured');
    }

    const config = connection.config || {};
    const encryptedKey = mode === 'live' ? config.live_secret_key : config.test_secret_key;

    if (!encryptedKey) {
      return badRequest(`${mode === 'live' ? 'Live' : 'Test'} secret key not configured`);
    }

    // Decrypt the key before using
    const secretKey = decryptIfNeeded(encryptedKey);

    // Test connection with the key
    let testResult: { success: boolean; message?: string; error?: string };
    try {
      const stripe = new Stripe(secretKey, {
        apiVersion: '2025-11-17.clover',
        typescript: true,
      });

      const account = await stripe.accounts.retrieve();
      testResult = {
        success: true,
        message: `Successfully connected to Stripe ${mode} mode (${account.id})`,
      };
    } catch (error) {
      testResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Update connection with test results
    await adminClient
      .from('system_connections')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: testResult.success ? 'success' : 'failed',
        last_test_error: testResult.error || null,
        test_mode: mode === 'test',
      })
      .eq('id', connection.id);

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      error: testResult.error,
    });
  } catch (error) {
    logger.error('Error in POST /api/global/admin/system/connections/stripe/test:', error);
    return internalError('Failed to test Stripe connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

