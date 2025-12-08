import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { rotateApiKey, getApiKeyByKeyId } from '@/lib/apiKeys';
import { unauthorized, forbidden, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const API_KEY_PREFIX = 'sk_live_';

/**
 * Helper function to check super admin access
 */
async function requireSuperAdmin(request: NextRequest): Promise<{ userId: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    throw unauthorized('You must be logged in');
  }

  // Get user record to check super admin status
  let userData;
  const { data: regularUserData, error: regularUserError } = await supabase
    .from('users')
    .select('id, role, is_super_admin')
    .eq('auth_id', authUser.id)
    .single();

  if (regularUserError || !regularUserData) {
    const adminClient = createAdminSupabaseClient();
    const { data: adminUserData, error: adminUserError } = await adminClient
      .from('users')
      .select('id, role, is_super_admin')
      .eq('auth_id', authUser.id)
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
 * POST /api/admin/api-keys/[id]/rotate
 * Rotate API key (super admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireSuperAdmin(request);

    // Get existing key
    const adminClient = createAdminSupabaseClient();
    const { data: existingKey, error: fetchError } = await adminClient
      .from('api_keys')
      .select('key_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingKey) {
      return notFound('API key not found');
    }

    // Rotate key
    const { fullKey, keyRecord } = await rotateApiKey(existingKey.key_id, userId);

    // Create audit log
    await adminClient.from('api_key_audit_logs').insert({
      api_key_id: params.id,
      actor_id: userId,
      action: 'rotated',
      before_snapshot: {
        key_id: existingKey.key_id,
      },
      after_snapshot: {
        key_id: keyRecord.key_id,
      },
    });

    // Return new full key (shown only once)
    return NextResponse.json({
      api_key: fullKey,
      key: {
        ...keyRecord,
        key_id: `${keyRecord.key_id.substring(0, API_KEY_PREFIX.length + 8)}****`, // Masked
      },
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse; // Already a NextResponse error
    }
    logger.error('[API Keys] Error rotating key:', error);
    return internalError('Failed to rotate API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

