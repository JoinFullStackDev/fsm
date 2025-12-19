import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { UpdateUserInsightInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; insightId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, insightId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(insightId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: insight, error } = await adminClient.from('workspace_user_insights').select('*').eq('id', insightId).eq('workspace_id', workspace.id).single();
    if (error || !insight) return notFound('Insight not found');

    return NextResponse.json(insight);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; insightId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, insightId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(insightId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: existing } = await adminClient.from('workspace_user_insights').select('id').eq('id', insightId).eq('workspace_id', workspace.id).single();
    if (!existing) return notFound('Insight not found');

    const body = await request.json() as UpdateUserInsightInput;

    const { data: insight, error } = await adminClient.from('workspace_user_insights').update({
      ...(body.insight_type !== undefined && { insight_type: body.insight_type }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.full_content !== undefined && { full_content: body.full_content }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.pain_points !== undefined && { pain_points: body.pain_points }),
      ...(body.feature_requests !== undefined && { feature_requests: body.feature_requests }),
      ...(body.quotes !== undefined && { quotes: body.quotes }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.user_segment !== undefined && { user_segment: body.user_segment }),
      ...(body.user_role !== undefined && { user_role: body.user_role }),
      ...(body.validated_assumptions !== undefined && { validated_assumptions: body.validated_assumptions }),
      ...(body.invalidated_assumptions !== undefined && { invalidated_assumptions: body.invalidated_assumptions }),
      ...(body.linked_clarity_spec_id !== undefined && { linked_clarity_spec_id: body.linked_clarity_spec_id }),
      ...(body.insight_date !== undefined && { insight_date: body.insight_date }),
    }).eq('id', insightId).select().single();

    if (error) {
      logger.error('[Discovery API] Failed to update insight:', error);
      return internalError('Failed to update insight');
    }

    logger.info('[Discovery API] Insight updated:', { insightId });
    return NextResponse.json(insight);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; insightId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, insightId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(insightId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { error } = await adminClient.from('workspace_user_insights').delete().eq('id', insightId).eq('workspace_id', workspace.id);
    if (error) {
      logger.error('[Discovery API] Failed to delete insight:', error);
      return internalError('Failed to delete insight');
    }

    logger.info('[Discovery API] Insight deleted:', { insightId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

