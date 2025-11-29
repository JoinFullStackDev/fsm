import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import { testEmailConnection } from '@/lib/globalAdmin';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/global/admin/system/connections/email/test
 * Test Email (SendGrid) connection (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get email connection from database
    const { data: connection, error: fetchError } = await adminClient
      .from('system_connections')
      .select('*')
      .eq('connection_type', 'email')
      .single();

    if (fetchError || !connection) {
      return badRequest('Email connection not configured');
    }

    const config = connection.config || {};
    const encryptedApiKey = config.api_key;

    if (!encryptedApiKey) {
      return badRequest('SendGrid API key not configured');
    }

    // Test connection using the testEmailConnection function
    // Pass the encrypted key - testEmailConnection will decrypt it
    const testResult = await testEmailConnection({
      provider: 'sendgrid',
      sendgrid: {
        apiKey: encryptedApiKey, // This is encrypted, testEmailConnection will handle decryption
      },
    });

    // Update connection with test results
    await adminClient
      .from('system_connections')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: testResult.success ? 'success' : 'failed',
        last_test_error: testResult.error || null,
      })
      .eq('id', connection.id);

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      error: testResult.error,
    });
  } catch (error) {
    logger.error('Error in POST /api/global/admin/system/connections/email/test:', error);
    return internalError('Failed to test email connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

