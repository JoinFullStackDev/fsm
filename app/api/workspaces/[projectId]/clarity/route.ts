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
import type { CreateClaritySpecInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/clarity
 * List all clarity spec versions for a workspace
 */
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

    // Get all clarity specs, ordered by version
    const { data: specs, error } = await adminClient
      .from('clarity_specs')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('version', { ascending: false });

    if (error) {
      logger.error('[Clarity API] Failed to fetch specs:', error);
      return internalError('Failed to fetch clarity specs');
    }

    return NextResponse.json(specs || []);
  } catch (error) {
    logger.error('[Clarity API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/clarity
 * Create new clarity spec version
 */
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

    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: user } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return notFound('User record not found');
    }

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

    // Get latest version number
    const { data: latestSpec } = await adminClient
      .from('clarity_specs')
      .select('version')
      .eq('workspace_id', workspace.id)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = latestSpec ? latestSpec.version + 1 : 1;

    // Parse request body
    const body = await request.json();
    const input: Partial<CreateClaritySpecInput> = body;

    // Create new spec
    const { data: newSpec, error } = await adminClient
      .from('clarity_specs')
      .insert({
        workspace_id: workspace.id,
        version: nextVersion,
        problem_statement: input.problem_statement || null,
        jobs_to_be_done: input.jobs_to_be_done || [],
        user_pains: input.user_pains || [],
        business_goals: input.business_goals || [],
        success_metrics: input.success_metrics || [],
        constraints: input.constraints || [],
        assumptions: input.assumptions || [],
        desired_outcomes: input.desired_outcomes || [],
        mental_model_notes: input.mental_model_notes || null,
        stakeholder_notes: input.stakeholder_notes || null,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !newSpec) {
      logger.error('[Clarity API] Failed to create spec:', error);
      return internalError('Failed to create clarity spec');
    }

    // Set as active if this is the first spec
    if (nextVersion === 1) {
      await adminClient
        .from('project_workspaces')
        .update({ active_clarity_spec_id: newSpec.id })
        .eq('id', workspace.id);
    }

    logger.info('[Clarity API] Created new spec:', {
      specId: newSpec.id,
      workspaceId: workspace.id,
      version: nextVersion,
    });

    return NextResponse.json(newSpec);
  } catch (error) {
    logger.error('[Clarity API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
