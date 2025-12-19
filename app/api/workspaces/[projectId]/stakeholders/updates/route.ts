import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

const adminClient = createAdminSupabaseClient();
import type { CreateStakeholderUpdateInput, StakeholderUpdate } from '@/types/workspace-extended';

// GET /api/workspaces/[projectId]/stakeholders/updates - List all stakeholder updates
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;
    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
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

    const { searchParams } = new URL(request.url);
    const updateType = searchParams.get('update_type');
    const approvalStatus = searchParams.get('approval_status');
    const stakeholderId = searchParams.get('stakeholder_id');

    let query = adminClient
      .from('workspace_stakeholder_updates')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (updateType) {
      query = query.eq('update_type', updateType);
    }
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (stakeholderId) {
      query = query.contains('stakeholder_ids', [stakeholderId]);
    }

    const { data, error} = await query;

    if (error) {
      logger.error('[Stakeholder Updates API] Error fetching updates:', error);
      return internalError('Failed to fetch stakeholder updates');
    }

    return NextResponse.json({ updates: data || [] });
  } catch (error) {
    logger.error('[Stakeholder Updates API] Unexpected error in GET:', error);
    return internalError('An unexpected error occurred');
  }
}

// POST /api/workspaces/[projectId]/stakeholders/updates - Create a new stakeholder update
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;
    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
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

    const body: CreateStakeholderUpdateInput = await request.json();

    // Validate required fields
    if (!body.update_type || !body.title) {
      return badRequest('Update type and title are required');
    }

    const updateData: Partial<StakeholderUpdate> = {
      workspace_id: workspace.id,
      update_type: body.update_type,
      title: body.title,
      summary: body.summary || null,
      full_content: body.full_content || null,
      stakeholder_ids: body.stakeholder_ids || [],
      feedback_received: [],
      action_items: [],
      approval_status: null,
      linked_clarity_spec_id: body.linked_clarity_spec_id || null,
      linked_epic_draft_id: body.linked_epic_draft_id || null,
      linked_roadmap_item_id: body.linked_roadmap_item_id || null,
      sent_date: body.sent_date || null,
    };

    const { data, error } = await adminClient
      .from('workspace_stakeholder_updates')
      .insert(updateData)
      .select()
      .single();

    if (error) {
      logger.error('[Stakeholder Updates API] Error creating update:', error);
      return internalError('Failed to create stakeholder update');
    }

    return NextResponse.json({ update: data }, { status: 201 });
  } catch (error) {
    logger.error('[Stakeholder Updates API] Unexpected error in POST:', error);
    return internalError('An unexpected error occurred');
  }
}

