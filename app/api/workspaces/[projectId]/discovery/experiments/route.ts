import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateExperimentInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId } = params;
    if (!isValidUUID(projectId)) return badRequest('Invalid project ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const experimentType = searchParams.get('experiment_type');

    let query = adminClient.from('workspace_experiments').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (experimentType) query = query.eq('experiment_type', experimentType);

    const { data: experiments, error } = await query;
    if (error) {
      logger.error('[Discovery API] Failed to fetch experiments:', error);
      return internalError('Failed to fetch experiments');
    }

    return NextResponse.json(experiments || []);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId } = params;
    if (!isValidUUID(projectId)) return badRequest('Invalid project ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const { data: userRecord } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single();
    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const body = await request.json() as CreateExperimentInput;
    if (!body.title || !body.hypothesis || !body.experiment_type) return badRequest('Title, hypothesis, and type are required');

    const { data: experiment, error } = await adminClient.from('workspace_experiments').insert({
      workspace_id: workspace.id,
      title: body.title,
      hypothesis: body.hypothesis,
      experiment_type: body.experiment_type,
      description: body.description || null,
      success_criteria: body.success_criteria || [],
      target_sample_size: body.target_sample_size || null,
      linked_clarity_spec_id: body.linked_clarity_spec_id || null,
      start_date: body.start_date || null,
      created_by: userRecord?.id || null,
    }).select().single();

    if (error) {
      logger.error('[Discovery API] Failed to create experiment:', error);
      return internalError('Failed to create experiment');
    }

    logger.info('[Discovery API] Experiment created:', { experimentId: experiment.id });
    return NextResponse.json(experiment, { status: 201 });
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

