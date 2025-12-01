import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createApiKeyRecord } from '@/lib/apiKeys';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getUserIdForRateLimit } from '@/lib/utils/rateLimit';
import logger from '@/lib/utils/logger';
import type { CreateApiKeyRequest } from '@/types/apiKeys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/api-keys
 * List all API keys (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for admin endpoints
    const userId = await getUserIdForRateLimit(request);
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.admin, userId);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view API keys');
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
        return unauthorized('User not found');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    // Check admin access
    if (userData.role !== 'admin') {
      return forbidden('Admin access required');
    }

    // Get user's organization for org admins
    const userOrgId = await getUserOrganizationId(supabase, session.user.id);
    const isSuperAdmin = userData.is_super_admin === true;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const scope = searchParams.get('scope');
    const organizationId = searchParams.get('organization_id');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('api_keys')
      .select('id, key_id, name, scope, organization_id, permissions, status, expires_at, last_used_at, description, created_by, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // For org admins, filter by their organization
    if (!isSuperAdmin && userOrgId) {
      query = query.eq('organization_id', userOrgId);
    } else if (organizationId) {
      // Super admins can filter by any organization
      query = query.eq('organization_id', organizationId);
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (scope) {
      query = query.eq('scope', scope);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: keys, error, count } = await query;

    if (error) {
      logger.error('[API Keys] Error fetching keys:', error);
      return internalError('Failed to fetch API keys');
    }

    // Mask key_id for display (show only first 8 chars of secret)
    const maskedKeys = keys?.map((key) => ({
      ...key,
      key_id: key.key_id ? `${key.key_id.substring(0, API_KEY_PREFIX.length + 8)}****` : null,
    })) || [];

    return NextResponse.json({
      data: maskedKeys,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('[API Keys] Unexpected error:', error);
    return internalError('Failed to fetch API keys');
  }
}

/**
 * POST /api/admin/api-keys
 * Create new API key (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for admin endpoints
    const userId = await getUserIdForRateLimit(request);
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.admin, userId);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create API keys');
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
        return unauthorized('User not found');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    // Check admin access
    if (userData.role !== 'admin') {
      return forbidden('Admin access required');
    }

    const isSuperAdmin = userData.is_super_admin === true;
    const userOrgId = await getUserOrganizationId(supabase, session.user.id);

    // Parse request body
    const body = await request.json();
    let { name, scope, organization_id, permissions, expires_at, description, key_prefix } = body;

    // Validate required fields
    if (!name || !scope || !permissions) {
      return badRequest('name, scope, and permissions are required');
    }

    // Validate scope
    if (scope !== 'global' && scope !== 'org') {
      return badRequest('scope must be "global" or "org"');
    }

    // Validate permissions
    if (permissions !== 'read' && permissions !== 'write') {
      return badRequest('permissions must be "read" or "write"');
    }

    // Org admins can only create org-scoped keys for their organization
    if (!isSuperAdmin) {
      if (scope === 'global') {
        return forbidden('Organization admins can only create org-scoped keys');
      }
      if (!userOrgId) {
        return badRequest('User is not assigned to an organization');
      }
      // Force organization_id to user's organization
      organization_id = userOrgId;
    } else {
      // Super admins can create global or org-scoped keys
      // Validate org-scoped keys require organization_id
      if (scope === 'org' && !organization_id) {
        return badRequest('organization_id is required for org-scoped keys');
      }

      // Validate global keys don't have organization_id
      if (scope === 'global' && organization_id) {
        return badRequest('organization_id cannot be set for global-scoped keys');
      }
    }

    // Create API key
    const { fullKey, keyRecord } = await createApiKeyRecord(
      {
        name,
        scope,
        organization_id: scope === 'org' ? organization_id : null,
        permissions,
        expires_at: expires_at || null,
        description: description || null,
        key_prefix: key_prefix || null,
      },
      userData.id
    );

    // Create audit log
    const adminClient = createAdminSupabaseClient();
    await adminClient.from('api_key_audit_logs').insert({
      api_key_id: keyRecord.id,
      actor_id: userData.id,
      action: 'created',
      after_snapshot: {
        name: keyRecord.name,
        scope: keyRecord.scope,
        permissions: keyRecord.permissions,
        status: keyRecord.status,
      },
    });

    // Return full key (shown only once)
    return NextResponse.json({
      api_key: fullKey,
      key: {
        ...keyRecord,
        key_id: `${keyRecord.key_id.substring(0, API_KEY_PREFIX.length + 8)}****`, // Masked
      },
    });
  } catch (error) {
    logger.error('[API Keys] Error creating key:', error);
    return internalError('Failed to create API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Import API_KEY_PREFIX for masking
const API_KEY_PREFIX = 'sk_live_';

