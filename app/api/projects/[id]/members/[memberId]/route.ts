import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/projects/[id]/members/[memberId]
 * 
 * Removes a member from a project.
 * Requires authentication and appropriate permissions.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    // Validate UUID formats
    if (!isValidUUID(params.id) || !isValidUUID(params.memberId)) {
      return badRequest('Invalid project ID or member ID format');
    }

    // Verify CSRF token for state-changing requests
    const { requireCsrfToken, shouldSkipCsrf } = await import('@/lib/utils/csrf');
    if (!shouldSkipCsrf(request.nextUrl.pathname)) {
      const csrfError = await requireCsrfToken(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to remove project members');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin, is_company_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Project Member DELETE] User not found:', userError);
      return notFound('User not found');
    }

    // Verify project exists and get project details
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, owner_id, organization_id, name')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Check permissions: super admins, company admins, project owners can remove members
    const isSuperAdmin = userData.is_super_admin === true;
    const isCompanyAdmin = userData.is_company_admin === true;
    const isLegacyAdmin = userData.role === 'admin' && !userData.is_super_admin;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;

    if (!isSuperAdmin && !isCompanyAdmin && !isLegacyAdmin && !isProjectOwner && !projectInUserOrg) {
      // Check if user is a project member (members can remove themselves)
      const { data: currentUserMember } = await adminClient
        .from('project_members')
        .select('id, user_id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();

      if (!currentUserMember) {
        return forbidden('You do not have permission to remove members from this project');
      }

      // If user is a member but not owner/admin/pm, they can only remove themselves
      const { data: memberToRemove } = await adminClient
        .from('project_members')
        .select('id, user_id')
        .eq('id', params.memberId)
        .eq('project_id', params.id)
        .single();

      if (!memberToRemove) {
        return notFound('Project member not found');
      }

      if (memberToRemove.user_id !== userData.id) {
        return forbidden('You can only remove yourself from this project');
      }
    }

    // Verify member exists and belongs to this project
    const { data: existingMember, error: memberCheckError } = await adminClient
      .from('project_members')
      .select('id, user_id')
      .eq('id', params.memberId)
      .eq('project_id', params.id)
      .single();

    if (memberCheckError || !existingMember) {
      return notFound('Project member not found');
    }

    // Use admin client to bypass RLS for deleting members
    const { error: deleteError } = await adminClient
      .from('project_members')
      .delete()
      .eq('id', params.memberId)
      .eq('project_id', params.id);

    if (deleteError) {
      logger.error('[Project Member DELETE] Error removing member:', deleteError);
      return internalError('Failed to remove project member', { error: deleteError.message });
    }

    // Invalidate cache after removing member - use cacheDel to clear both Redis and in-memory
    try {
      const { cacheDel, CACHE_KEYS } = await import('@/lib/cache/unifiedCache');
      const membersCacheKey = CACHE_KEYS.projectMembers(params.id);
      await cacheDel(membersCacheKey);
    } catch (cacheError) {
      logger.warn('[Project Member DELETE] Failed to invalidate cache:', cacheError);
      // Don't fail the request if cache invalidation fails
    }

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('[Project Member DELETE] Unexpected error:', error);
    return internalError('Failed to remove project member', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

