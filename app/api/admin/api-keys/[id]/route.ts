import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { revokeApiKey } from '@/lib/apiKeys';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const API_KEY_PREFIX = 'sk_live_';

/**
 * Helper function to check super admin access
 */
async function requireSuperAdmin(request: NextRequest): Promise<{ userId: string }> {
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
 * GET /api/admin/api-keys/[id]
 * Get API key details (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);

    const adminClient = createAdminSupabaseClient();
    const { data: key, error } = await adminClient
      .from('api_keys')
      .select('id, key_id, name, scope, organization_id, permissions, status, expires_at, last_used_at, description, created_by, created_at, updated_at')
      .eq('id', params.id)
      .single();

    if (error || !key) {
      return notFound('API key not found');
    }

    // Mask key_id for display
    const maskedKey = {
      ...key,
      key_id: key.key_id ? `${key.key_id.substring(0, API_KEY_PREFIX.length + 8)}****` : null,
    };

    return NextResponse.json(maskedKey);
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API Keys] Error fetching key:', error);
    return internalError('Failed to fetch API key');
  }
}

/**
 * PATCH /api/admin/api-keys/[id]
 * Update API key (super admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireSuperAdmin(request);

    const body = await request.json();
    const { name, description, expires_at } = body;

    // Get existing key to create audit log
    const adminClient = createAdminSupabaseClient();
    const { data: existingKey, error: fetchError } = await adminClient
      .from('api_keys')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingKey) {
      return notFound('API key not found');
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (expires_at !== undefined) updates.expires_at = expires_at || null;

    if (Object.keys(updates).length === 0) {
      return badRequest('No fields to update');
    }

    // Update key
    const { data: updatedKey, error: updateError } = await adminClient
      .from('api_keys')
      .update(updates)
      .eq('id', params.id)
      .select('id, key_id, name, scope, organization_id, permissions, status, expires_at, last_used_at, description, created_by, created_at, updated_at')
      .single();

    if (updateError || !updatedKey) {
      logger.error('[API Keys] Error updating key:', updateError);
      return internalError('Failed to update API key');
    }

    // Create audit log
    await adminClient.from('api_key_audit_logs').insert({
      api_key_id: params.id,
      actor_id: userId,
      action: 'permissions_changed', // Generic action for updates
      before_snapshot: {
        name: existingKey.name,
        description: existingKey.description,
        expires_at: existingKey.expires_at,
      },
      after_snapshot: {
        name: updatedKey.name,
        description: updatedKey.description,
        expires_at: updatedKey.expires_at,
      },
    });

    // Mask key_id for display
    const maskedKey = {
      ...updatedKey,
      key_id: updatedKey.key_id ? `${updatedKey.key_id.substring(0, API_KEY_PREFIX.length + 8)}****` : null,
    };

    return NextResponse.json(maskedKey);
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API Keys] Error updating key:', error);
    return internalError('Failed to update API key');
  }
}

/**
 * DELETE /api/admin/api-keys/[id]
 * Revoke API key (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireSuperAdmin(request);

    // Get existing key to create audit log
    const adminClient = createAdminSupabaseClient();
    const { data: existingKey, error: fetchError } = await adminClient
      .from('api_keys')
      .select('key_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingKey) {
      return notFound('API key not found');
    }

    // Revoke key
    await revokeApiKey(existingKey.key_id);

    // Create audit log
    await adminClient.from('api_key_audit_logs').insert({
      api_key_id: params.id,
      actor_id: userId,
      action: 'revoked',
      before_snapshot: {
        status: 'active',
      },
      after_snapshot: {
        status: 'revoked',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API Keys] Error revoking key:', error);
    return internalError('Failed to revoke API key');
  }
}

