import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { UpdateFeedbackInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string; feedbackId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, feedbackId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(feedbackId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: feedback, error } = await adminClient.from('workspace_feedback').select('*').eq('id', feedbackId).eq('workspace_id', workspace.id).single();
    if (error || !feedback) return notFound('Feedback not found');

    return NextResponse.json(feedback);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; feedbackId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, feedbackId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(feedbackId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: existing } = await adminClient.from('workspace_feedback').select('id').eq('id', feedbackId).eq('workspace_id', workspace.id).single();
    if (!existing) return notFound('Feedback not found');

    const body = await request.json() as UpdateFeedbackInput;

    const { data: feedback, error } = await adminClient.from('workspace_feedback').update({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.feedback_type !== undefined && { feedback_type: body.feedback_type }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.affected_feature !== undefined && { affected_feature: body.affected_feature }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.source_url !== undefined && { source_url: body.source_url }),
      ...(body.submitted_by_email !== undefined && { submitted_by_email: body.submitted_by_email }),
      ...(body.submitted_by_name !== undefined && { submitted_by_name: body.submitted_by_name }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.upvote_count !== undefined && { upvote_count: body.upvote_count }),
      ...(body.similar_feedback_count !== undefined && { similar_feedback_count: body.similar_feedback_count }),
      ...(body.resolution_notes !== undefined && { resolution_notes: body.resolution_notes }),
      ...(body.linked_epic_draft_id !== undefined && { linked_epic_draft_id: body.linked_epic_draft_id }),
      ...(body.linked_task_id !== undefined && { linked_task_id: body.linked_task_id }),
      ...(body.resolved_date !== undefined && { resolved_date: body.resolved_date }),
    }).eq('id', feedbackId).select().single();

    if (error) {
      logger.error('[Discovery API] Failed to update feedback:', error);
      return internalError('Failed to update feedback');
    }

    logger.info('[Discovery API] Feedback updated:', { feedbackId });
    return NextResponse.json(feedback);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; feedbackId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, feedbackId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(feedbackId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { error } = await adminClient.from('workspace_feedback').delete().eq('id', feedbackId).eq('workspace_id', workspace.id);
    if (error) {
      logger.error('[Discovery API] Failed to delete feedback:', error);
      return internalError('Failed to delete feedback');
    }

    logger.info('[Discovery API] Feedback deleted:', { feedbackId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

