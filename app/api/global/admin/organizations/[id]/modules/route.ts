import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { badRequest, notFound, internalError } from '@/lib/utils/apiErrors';
import { clearCachedContextsForOrganization } from '@/lib/cache/organizationContextCache';
import logger from '@/lib/utils/logger';
import { AVAILABLE_MODULES } from '@/lib/modules';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/global/admin/organizations/[id]/modules
 * Toggle a module/plugin for an organization
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const body = await request.json();
    const { module_key, enabled } = body;

    if (!module_key) {
      return badRequest('module_key is required');
    }

    // Validate module key
    const moduleConfig = AVAILABLE_MODULES.find((m) => m.key === module_key);
    if (!moduleConfig) {
      return badRequest(`Invalid module key: ${module_key}`);
    }

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, module_overrides')
      .eq('id', params.id)
      .single();

    if (orgError || !organization) {
      return notFound('Organization not found');
    }

    // Get current overrides
    const currentOverrides = (organization.module_overrides as Record<string, boolean>) || {};

    // Update overrides
    const updatedOverrides = { ...currentOverrides };
    if (enabled === null || enabled === undefined) {
      // Remove override to use package default
      delete updatedOverrides[module_key];
    } else {
      updatedOverrides[module_key] = enabled === true;
    }

    // Update organization
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        module_overrides: updatedOverrides,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (updateError) {
      logger.error('[Modules] Error updating organization:', updateError);
      return internalError('Failed to update module', { error: updateError.message });
    }

    // Invalidate organization context cache for all users in this organization
    try {
      // Get all users in this organization to clear their cache
      const { data: orgUsers } = await adminClient
        .from('users')
        .select('auth_id')
        .eq('organization_id', params.id);
      
      if (orgUsers && orgUsers.length > 0) {
        const authIds = orgUsers.map(u => u.auth_id).filter(Boolean) as string[];
        clearCachedContextsForOrganization(params.id, authIds);
        logger.info('[Modules] Cleared cache for organization users', { 
          organizationId: params.id, 
          userCount: authIds.length 
        });
      }
    } catch (cacheError) {
      // Cache invalidation is best-effort, don't fail the request
      logger.warn('[Modules] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({
      success: true,
      module_overrides: updatedOverrides,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in PUT /api/global/admin/organizations/[id]/modules:', error);
    return internalError('Failed to update module', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

