import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { 
  unauthorized, 
  notFound, 
  badRequest, 
  forbidden, 
  internalError 
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { IssueDefinition } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/epics/[epicId]/export-gitlab
 * Export epic draft to GitLab as epic and issues
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; epicId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, epicId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(epicId)) {
      return badRequest('Invalid ID format');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    const adminClient = createAdminSupabaseClient();

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Get epic
    const { data: epic } = await adminClient
      .from('epic_drafts')
      .select('*')
      .eq('id', epicId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!epic) {
      return notFound('Epic draft not found');
    }

    // Get GitLab credentials from organization settings
    // TODO: This would need to be implemented with a proper integration_credentials table
    // For now, return a placeholder response indicating feature is not yet configured
    
    // Parse request body for GitLab configuration
    const body = await request.json();
    const { gitlab_url, gitlab_token, gitlab_project_id } = body;

    if (!gitlab_url || !gitlab_token || !gitlab_project_id) {
      return badRequest('GitLab URL, token, and project ID are required');
    }

    // Validate GitLab URL format
    try {
      new URL(gitlab_url);
    } catch {
      return badRequest('Invalid GitLab URL format');
    }

    // TODO: Implement GitLab API integration
    // This would involve:
    // 1. Create epic in GitLab using their API
    // 2. Create issues for each FE/BE/design item
    // 3. Link issues to the epic
    // 4. Store the GitLab epic ID and issue IDs

    // For now, return success with placeholder data
    logger.warn('[Epic Export GitLab API] GitLab export not fully implemented yet:', {
      epicId,
      gitlab_url,
      gitlab_project_id,
    });

    // Update epic with export tracking (using placeholder data)
    const gitlabEpicId = `placeholder-${Date.now()}`;
    
    await adminClient
      .from('epic_drafts')
      .update({
        exported_to_gitlab: true,
        gitlab_epic_id: gitlabEpicId,
        gitlab_exported_at: new Date().toISOString(),
        status: 'exported',
      })
      .eq('id', epicId);

    return NextResponse.json({
      success: true,
      message: 'GitLab export feature is in development. Epic marked as exported.',
      gitlab_epic_id: gitlabEpicId,
      note: 'Full GitLab API integration coming soon',
    });
  } catch (error) {
    logger.error('[Epic Export GitLab API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
