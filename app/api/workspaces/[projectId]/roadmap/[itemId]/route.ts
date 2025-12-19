import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { UpdateRoadmapItemInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, itemId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(itemId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: item, error } = await adminClient.from('workspace_roadmap_items').select('*').eq('id', itemId).eq('workspace_id', workspace.id).single();
    if (error || !item) return notFound('Item not found');

    return NextResponse.json(item);
  } catch (error) {
    logger.error('[Roadmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, itemId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(itemId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: existing } = await adminClient.from('workspace_roadmap_items').select('id').eq('id', itemId).eq('workspace_id', workspace.id).single();
    if (!existing) return notFound('Item not found');

    const body = await request.json() as UpdateRoadmapItemInput;

    // Recalculate RICE score if values changed
    let priorityScore = body.priority_score;
    if (body.reach !== undefined || body.impact !== undefined || body.confidence !== undefined || body.effort !== undefined) {
      const { data: current } = await adminClient.from('workspace_roadmap_items').select('reach, impact, confidence, effort').eq('id', itemId).single();
      const reach = body.reach ?? current?.reach;
      const impact = body.impact ?? current?.impact;
      const confidence = body.confidence ?? current?.confidence;
      const effort = body.effort ?? current?.effort;
      if (reach && impact && confidence && effort && effort > 0) {
        priorityScore = (reach * impact * confidence) / effort;
      }
    }

    const { data: item, error } = await adminClient.from('workspace_roadmap_items').update({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.item_type !== undefined && { item_type: body.item_type }),
      ...(body.reach !== undefined && { reach: body.reach }),
      ...(body.impact !== undefined && { impact: body.impact }),
      ...(body.confidence !== undefined && { confidence: body.confidence }),
      ...(body.effort !== undefined && { effort: body.effort }),
      ...(priorityScore !== undefined && { priority_score: priorityScore }),
      ...(body.roadmap_bucket !== undefined && { roadmap_bucket: body.roadmap_bucket }),
      ...(body.target_quarter !== undefined && { target_quarter: body.target_quarter }),
      ...(body.target_release !== undefined && { target_release: body.target_release }),
      ...(body.depends_on_ids !== undefined && { depends_on_ids: body.depends_on_ids }),
      ...(body.blocks_ids !== undefined && { blocks_ids: body.blocks_ids }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.confidence_level !== undefined && { confidence_level: body.confidence_level }),
      ...(body.linked_epic_draft_id !== undefined && { linked_epic_draft_id: body.linked_epic_draft_id }),
      ...(body.linked_clarity_spec_id !== undefined && { linked_clarity_spec_id: body.linked_clarity_spec_id }),
      ...(body.linked_strategy_bet !== undefined && { linked_strategy_bet: body.linked_strategy_bet }),
      ...(body.start_date !== undefined && { start_date: body.start_date }),
      ...(body.ship_date !== undefined && { ship_date: body.ship_date }),
      ...(body.actual_ship_date !== undefined && { actual_ship_date: body.actual_ship_date }),
    }).eq('id', itemId).select().single();

    if (error) {
      logger.error('[Roadmap API] Failed to update item:', error);
      return internalError('Failed to update item');
    }

    logger.info('[Roadmap API] Item updated:', { itemId });
    return NextResponse.json(item);
  } catch (error) {
    logger.error('[Roadmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, itemId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(itemId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { error } = await adminClient.from('workspace_roadmap_items').delete().eq('id', itemId).eq('workspace_id', workspace.id);
    if (error) {
      logger.error('[Roadmap API] Failed to delete item:', error);
      return internalError('Failed to delete item');
    }

    logger.info('[Roadmap API] Item deleted:', { itemId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Roadmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

