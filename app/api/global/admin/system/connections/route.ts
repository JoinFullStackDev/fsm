import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/system/connections
 * Get all system connections (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: connections, error } = await adminClient
      .from('system_connections')
      .select('*')
      .order('connection_type');

    if (error) {
      logger.error('Error loading system connections:', error);
      return internalError('Failed to load connections', { error: error.message });
    }

    // Group by connection type
    interface SystemConnection {
      id: string;
      connection_type: string;
      is_active: boolean;
      test_mode: boolean;
      config: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    }
    const grouped: Record<string, SystemConnection> = {};
    ((connections || []) as SystemConnection[]).forEach((conn) => {
      // Sanitize sensitive data before returning to client
      const sanitizedConn = { ...conn };
      
      if (conn.connection_type === 'stripe' && conn.config) {
        // Remove actual secret keys, replace with boolean flags
        const config = conn.config as Record<string, unknown>;
        sanitizedConn.config = {
          // Keep publishable keys (they're meant to be public)
          test_publishable_key: config.test_publishable_key || null,
          live_publishable_key: config.live_publishable_key || null,
          // Replace secret keys with boolean indicators
          has_test_secret_key: !!config.test_secret_key,
          has_live_secret_key: !!config.live_secret_key,
        };
      }
      // Note: email/SendGrid keys are already encrypted and not returned for display
      // The UI checks for existence with has_api_key indicator
      if (conn.connection_type === 'email' && conn.config) {
        const config = conn.config as Record<string, unknown>;
        sanitizedConn.config = {
          from_email: config.from_email || null,
          sender_email: config.sender_email || null,
          sender_name: config.sender_name || null,
          // Indicate if API key is configured without exposing it
          has_api_key: !!config.api_key,
        };
      }
      
      grouped[conn.connection_type] = sanitizedConn;
    });

    return NextResponse.json({ connections: grouped });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/system/connections:', error);
    return internalError('Failed to load connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

