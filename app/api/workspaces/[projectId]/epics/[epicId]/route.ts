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
import type { UpdateEpicDraftInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/epics/[epicId]
 * Get single epic draft
 */
export async function GET(
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
    const { data: epic, error } = await adminClient
      .from('epic_drafts')
      .select('*')
      .eq('id', epicId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error || !epic) {
      return notFound('Epic draft not found');
    }

    return NextResponse.json(epic);
  } catch (error) {
    logger.error('[Epic API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * PATCH /api/workspaces/[projectId]/epics/[epicId]
 * Update epic draft
 */
export async function PATCH(
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

    // Verify epic exists
    const { data: existingEpic } = await adminClient
      .from('epic_drafts')
      .select('id')
      .eq('id', epicId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!existingEpic) {
      return notFound('Epic draft not found');
    }

    // Parse update data
    const body = await request.json();
    const updates: UpdateEpicDraftInput = body;

    // Update epic
    const { data: updatedEpic, error } = await adminClient
      .from('epic_drafts')
      .update(updates)
      .eq('id', epicId)
      .select()
      .single();

    if (error || !updatedEpic) {
      logger.error('[Epic API] Failed to update epic:', error);
      return internalError('Failed to update epic draft');
    }

    return NextResponse.json(updatedEpic);
  } catch (error) {
    logger.error('[Epic API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * DELETE /api/workspaces/[projectId]/epics/[epicId]
 * Delete (archive) epic draft
 */
export async function DELETE(
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

    // Archive the epic instead of deleting
    const { error } = await adminClient
      .from('epic_drafts')
      .update({ status: 'archived' })
      .eq('id', epicId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Epic API] Failed to archive epic:', error);
      return internalError('Failed to archive epic draft');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Epic API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
