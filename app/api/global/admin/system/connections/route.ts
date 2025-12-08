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
      grouped[conn.connection_type] = conn;
    });

    return NextResponse.json({ connections: grouped });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/system/connections:', error);
    return internalError('Failed to load connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

