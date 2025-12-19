import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { UpdateExperimentInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string; experimentId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, experimentId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(experimentId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: experiment, error } = await adminClient.from('workspace_experiments').select('*').eq('id', experimentId).eq('workspace_id', workspace.id).single();
    if (error || !experiment) return notFound('Experiment not found');

    return NextResponse.json(experiment);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; experimentId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, experimentId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(experimentId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: existing } = await adminClient.from('workspace_experiments').select('id').eq('id', experimentId).eq('workspace_id', workspace.id).single();
    if (!existing) return notFound('Experiment not found');

    const body = await request.json() as UpdateExperimentInput;

    const { data: experiment, error } = await adminClient.from('workspace_experiments').update({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.hypothesis !== undefined && { hypothesis: body.hypothesis }),
      ...(body.experiment_type !== undefined && { experiment_type: body.experiment_type }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.success_criteria !== undefined && { success_criteria: body.success_criteria }),
      ...(body.target_sample_size !== undefined && { target_sample_size: body.target_sample_size }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.actual_sample_size !== undefined && { actual_sample_size: body.actual_sample_size }),
      ...(body.results_summary !== undefined && { results_summary: body.results_summary }),
      ...(body.key_learnings !== undefined && { key_learnings: body.key_learnings }),
      ...(body.hypothesis_validated !== undefined && { hypothesis_validated: body.hypothesis_validated }),
      ...(body.confidence_level !== undefined && { confidence_level: body.confidence_level }),
      ...(body.next_actions !== undefined && { next_actions: body.next_actions }),
      ...(body.start_date !== undefined && { start_date: body.start_date }),
      ...(body.end_date !== undefined && { end_date: body.end_date }),
      ...(body.linked_clarity_spec_id !== undefined && { linked_clarity_spec_id: body.linked_clarity_spec_id }),
    }).eq('id', experimentId).select().single();

    if (error) {
      logger.error('[Discovery API] Failed to update experiment:', error);
      return internalError('Failed to update experiment');
    }

    logger.info('[Discovery API] Experiment updated:', { experimentId });
    return NextResponse.json(experiment);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; experimentId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, experimentId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(experimentId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { error } = await adminClient.from('workspace_experiments').delete().eq('id', experimentId).eq('workspace_id', workspace.id);
    if (error) {
      logger.error('[Discovery API] Failed to delete experiment:', error);
      return internalError('Failed to delete experiment');
    }

    logger.info('[Discovery API] Experiment deleted:', { experimentId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

