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

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]
 * Get or create workspace for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to access workspaces');
    }

    const { projectId } = params;

    // Validate project ID
    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID format');
    }

    // Get user's organization ID
    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get organization context and check feature flag
    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext) {
      return notFound('Organization not found');
    }

    const features = orgContext.package?.features;
    if (!features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled for your organization');
    }

    // Use admin client for queries
    const adminClient = createAdminSupabaseClient();

    // Verify project exists and user has access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (projectError || !project) {
      logger.warn('[Workspace API] Project not found or access denied:', {
        projectId,
        organizationId,
        error: projectError?.message,
      });
      return notFound('Project not found or access denied');
    }

    // Get user record for created_by
    const { data: user } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return notFound('User record not found');
    }

    // Check if workspace exists
    const { data: existingWorkspace } = await adminClient
      .from('project_workspaces')
      .select('*')
      .eq('project_id', projectId)
      .single();

    let workspace;

    if (existingWorkspace) {
      // Update last_accessed_at
      const { data: updatedWorkspace, error: updateError } = await adminClient
        .from('project_workspaces')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', existingWorkspace.id)
        .select()
        .single();

      if (updateError) {
        logger.error('[Workspace API] Failed to update last_accessed_at:', {
          workspaceId: existingWorkspace.id,
          error: updateError.message,
        });
      }

      workspace = updatedWorkspace || existingWorkspace;
    } else {
      // Create new workspace
      const { data: newWorkspace, error: createError } = await adminClient
        .from('project_workspaces')
        .insert({
          project_id: projectId,
          organization_id: organizationId,
          created_by: user.id,
          last_accessed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !newWorkspace) {
        logger.error('[Workspace API] Failed to create workspace:', {
          projectId,
          organizationId,
          error: createError?.message,
        });
        return internalError('Failed to create workspace');
      }

      workspace = newWorkspace;
      
      logger.info('[Workspace API] Created new workspace:', {
        workspaceId: workspace.id,
        projectId,
        organizationId,
      });
    }

    // Get counts for related entities
    const [clarityCount, epicCount, decisionCount, debtCount] = await Promise.all([
      adminClient
        .from('clarity_specs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id),
      adminClient
        .from('epic_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id),
      adminClient
        .from('workspace_decisions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id),
      adminClient
        .from('workspace_debt')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id),
    ]);

    const workspaceWithCounts = {
      ...workspace,
      clarity_spec_count: clarityCount.count || 0,
      epic_draft_count: epicCount.count || 0,
      decision_count: decisionCount.count || 0,
      debt_count: debtCount.count || 0,
    };

    return NextResponse.json(workspaceWithCounts);
  } catch (error) {
    logger.error('[Workspace API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
