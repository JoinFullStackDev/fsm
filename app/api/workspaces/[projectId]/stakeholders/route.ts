import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

const adminClient = createAdminSupabaseClient();
import type { CreateStakeholderInput, Stakeholder } from '@/types/workspace-extended';

// GET /api/workspaces/[projectId]/stakeholders - List all stakeholders
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
    const alignment = searchParams.get('alignment');
    const powerLevel = searchParams.get('power_level');
    const interestLevel = searchParams.get('interest_level');

    let query = adminClient
      .from('workspace_stakeholders')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (alignment) {
      query = query.eq('alignment_status', alignment);
    }
    if (powerLevel) {
      query = query.eq('power_level', powerLevel);
    }
    if (interestLevel) {
      query = query.eq('interest_level', interestLevel);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[Stakeholders API] Error fetching stakeholders:', error);
      return internalError('Failed to fetch stakeholders');
    }

    return NextResponse.json({ stakeholders: data || [] });
  } catch (error) {
    logger.error('[Stakeholders API] Unexpected error in GET:', error);
    return internalError('An unexpected error occurred');
  }
}

// POST /api/workspaces/[projectId]/stakeholders - Create a new stakeholder
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

    const body: CreateStakeholderInput = await request.json();

    // Validate required fields
    if (!body.name) {
      return badRequest('Name is required');
    }

    const stakeholderData: Partial<Stakeholder> = {
      workspace_id: workspace.id,
      name: body.name,
      role: body.role || null,
      department: body.department || null,
      email: body.email || null,
      power_level: body.power_level || null,
      interest_level: body.interest_level || null,
      influence_type: body.influence_type || null,
      preferred_communication: body.preferred_communication || null,
      communication_frequency: body.communication_frequency || null,
      alignment_status: body.alignment_status || 'neutral',
      key_concerns: body.key_concerns || [],
      key_interests: body.key_interests || [],
    };

    const { data, error } = await adminClient
      .from('workspace_stakeholders')
      .insert(stakeholderData)
      .select()
      .single();

    if (error) {
      logger.error('[Stakeholders API] Error creating stakeholder:', error);
      return internalError('Failed to create stakeholder');
    }

    return NextResponse.json({ stakeholder: data }, { status: 201 });
  } catch (error) {
    logger.error('[Stakeholders API] Unexpected error in POST:', error);
    return internalError('An unexpected error occurred');
  }
}

