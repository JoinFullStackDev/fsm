import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

const adminClient = createAdminSupabaseClient();
import type { UpdateStakeholderInput } from '@/types/workspace-extended';

// GET /api/workspaces/[projectId]/stakeholders/[stakeholderId] - Get a single stakeholder
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; stakeholderId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, stakeholderId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(stakeholderId)) {
      return badRequest('Invalid ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    // Fetch workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    const { data, error } = await adminClient
      .from('workspace_stakeholders')
      .select('*')
      .eq('id', stakeholderId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound('Stakeholder not found');
      }
      logger.error('[Stakeholders API] Error fetching stakeholder:', error);
      return internalError('Failed to fetch stakeholder');
    }

    return NextResponse.json({ stakeholder: data });
  } catch (error) {
    logger.error('[Stakeholders API] Unexpected error in GET:', error);
    return internalError('An unexpected error occurred');
  }
}

// PATCH /api/workspaces/[projectId]/stakeholders/[stakeholderId] - Update a stakeholder
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; stakeholderId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, stakeholderId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(stakeholderId)) {
      return badRequest('Invalid ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    // Fetch workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    const body: UpdateStakeholderInput = await request.json();

    const updates: Partial<UpdateStakeholderInput> = {};
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.department !== undefined) updates.department = body.department;
    if (body.email !== undefined) updates.email = body.email;
    if (body.power_level !== undefined) updates.power_level = body.power_level;
    if (body.interest_level !== undefined) updates.interest_level = body.interest_level;
    if (body.influence_type !== undefined) updates.influence_type = body.influence_type;
    if (body.preferred_communication !== undefined) updates.preferred_communication = body.preferred_communication;
    if (body.communication_frequency !== undefined) updates.communication_frequency = body.communication_frequency;
    if (body.alignment_status !== undefined) updates.alignment_status = body.alignment_status;
    if (body.last_contacted_at !== undefined) updates.last_contacted_at = body.last_contacted_at;
    if (body.key_concerns !== undefined) updates.key_concerns = body.key_concerns;
    if (body.key_interests !== undefined) updates.key_interests = body.key_interests;

    if (Object.keys(updates).length === 0) {
      return badRequest('No updates provided');
    }

    const { data, error } = await adminClient
      .from('workspace_stakeholders')
      .update(updates)
      .eq('id', stakeholderId)
      .eq('workspace_id', workspace.id)
      .select()
      .single();

    if (error) {
      logger.error('[Stakeholders API] Error updating stakeholder:', error);
      return internalError('Failed to update stakeholder');
    }

    return NextResponse.json({ stakeholder: data });
  } catch (error) {
    logger.error('[Stakeholders API] Unexpected error in PATCH:', error);
    return internalError('An unexpected error occurred');
  }
}

// DELETE /api/workspaces/[projectId]/stakeholders/[stakeholderId] - Delete a stakeholder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; stakeholderId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, stakeholderId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(stakeholderId)) {
      return badRequest('Invalid ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    // Fetch workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    const { error } = await adminClient
      .from('workspace_stakeholders')
      .delete()
      .eq('id', stakeholderId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Stakeholders API] Error deleting stakeholder:', error);
      return internalError('Failed to delete stakeholder');
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('[Stakeholders API] Unexpected error in DELETE:', error);
    return internalError('An unexpected error occurred');
  }
}

