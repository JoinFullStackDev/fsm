import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

const adminClient = createAdminSupabaseClient();
import type { UpdateStakeholderUpdateInput } from '@/types/workspace-extended';

// Helper function to get workspace ID
async function getWorkspaceId(projectId: string, authUser: any) {
  const supabase = await createServerSupabaseClient();
  
  const organizationId = await getUserOrganizationId(supabase, authUser.id);
  if (!organizationId) {
    return null;
  }

  const { data: workspace } = await adminClient
    .from('project_workspaces')
    .select('id')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .single();

  return workspace?.id || null;
}

// GET /api/workspaces/[projectId]/stakeholders/updates/[updateId] - Get a single stakeholder update
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; updateId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, updateId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(updateId)) {
      return badRequest('Invalid ID');
    }

    const workspaceId = await getWorkspaceId(projectId, authUser);
    if (!workspaceId) {
      return notFound('Workspace not found');
    }

    const { data, error } = await adminClient
      .from('workspace_stakeholder_updates')
      .select('*')
      .eq('id', updateId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound('Stakeholder update not found');
      }
      logger.error('[Stakeholder Updates API] Error fetching update:', error);
      return internalError('Failed to fetch stakeholder update');
    }

    return NextResponse.json({ update: data });
  } catch (error) {
    logger.error('[Stakeholder Updates API] Unexpected error in GET:', error);
    return internalError('An unexpected error occurred');
  }
}

// PATCH /api/workspaces/[projectId]/stakeholders/updates/[updateId] - Update a stakeholder update
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; updateId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, updateId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(updateId)) {
      return badRequest('Invalid ID');
    }

    const workspaceId = await getWorkspaceId(projectId, authUser);
    if (!workspaceId) {
      return notFound('Workspace not found');
    }

    const body: UpdateStakeholderUpdateInput = await request.json();

    const updates: Partial<UpdateStakeholderUpdateInput> = {};
    
    if (body.update_type !== undefined) updates.update_type = body.update_type;
    if (body.title !== undefined) updates.title = body.title;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.full_content !== undefined) updates.full_content = body.full_content;
    if (body.stakeholder_ids !== undefined) updates.stakeholder_ids = body.stakeholder_ids;
    if (body.feedback_received !== undefined) updates.feedback_received = body.feedback_received;
    if (body.approval_status !== undefined) updates.approval_status = body.approval_status;
    if (body.action_items !== undefined) updates.action_items = body.action_items;
    if (body.linked_clarity_spec_id !== undefined) updates.linked_clarity_spec_id = body.linked_clarity_spec_id;
    if (body.linked_epic_draft_id !== undefined) updates.linked_epic_draft_id = body.linked_epic_draft_id;
    if (body.linked_roadmap_item_id !== undefined) updates.linked_roadmap_item_id = body.linked_roadmap_item_id;
    if (body.sent_date !== undefined) updates.sent_date = body.sent_date;

    if (Object.keys(updates).length === 0) {
      return badRequest('No updates provided');
    }

    const { data, error } = await adminClient
      .from('workspace_stakeholder_updates')
      .update(updates)
      .eq('id', updateId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      logger.error('[Stakeholder Updates API] Error updating update:', error);
      return internalError('Failed to update stakeholder update');
    }

    return NextResponse.json({ update: data });
  } catch (error) {
    logger.error('[Stakeholder Updates API] Unexpected error in PATCH:', error);
    return internalError('An unexpected error occurred');
  }
}

// DELETE /api/workspaces/[projectId]/stakeholders/updates/[updateId] - Delete a stakeholder update
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; updateId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, updateId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(updateId)) {
      return badRequest('Invalid ID');
    }

    const workspaceId = await getWorkspaceId(projectId, authUser);
    if (!workspaceId) {
      return notFound('Workspace not found');
    }

    const { error } = await adminClient
      .from('workspace_stakeholder_updates')
      .delete()
      .eq('id', updateId)
      .eq('workspace_id', workspaceId);

    if (error) {
      logger.error('[Stakeholder Updates API] Error deleting update:', error);
      return internalError('Failed to delete stakeholder update');
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('[Stakeholder Updates API] Unexpected error in DELETE:', error);
    return internalError('An unexpected error occurred');
  }
}

