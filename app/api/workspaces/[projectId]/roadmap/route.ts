import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateRoadmapItemInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
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
    const bucket = searchParams.get('bucket');
    const status = searchParams.get('status');

    let query = adminClient.from('workspace_roadmap_items').select('*').eq('workspace_id', workspace.id).order('priority_score', { ascending: false });
    if (bucket) query = query.eq('roadmap_bucket', bucket);
    if (status) query = query.eq('status', status);

    const { data: items, error } = await query;
    if (error) {
      logger.error('[Roadmap API] Failed to fetch items:', error);
      return internalError('Failed to fetch items');
    }

    return NextResponse.json(items || []);
  } catch (error) {
    logger.error('[Roadmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
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

    const body = await request.json() as CreateRoadmapItemInput;
    if (!body.title || !body.item_type) return badRequest('Title and type are required');

    // Calculate RICE score if all values provided
    let priorityScore = null;
    if (body.reach && body.impact && body.confidence && body.effort && body.effort > 0) {
      priorityScore = (body.reach * body.impact * body.confidence) / body.effort;
    }

    const { data: item, error } = await adminClient.from('workspace_roadmap_items').insert({
      workspace_id: workspace.id,
      title: body.title,
      description: body.description || null,
      item_type: body.item_type,
      roadmap_bucket: body.roadmap_bucket || 'later',
      reach: body.reach || null,
      impact: body.impact || null,
      confidence: body.confidence || null,
      effort: body.effort || null,
      priority_score: priorityScore,
      target_quarter: body.target_quarter || null,
      target_release: body.target_release || null,
      linked_epic_draft_id: body.linked_epic_draft_id || null,
      linked_clarity_spec_id: body.linked_clarity_spec_id || null,
      linked_strategy_bet: body.linked_strategy_bet || null,
      created_by: userRecord?.id || null,
    }).select().single();

    if (error) {
      logger.error('[Roadmap API] Failed to create item:', error);
      return internalError('Failed to create item');
    }

    logger.info('[Roadmap API] Item created:', { itemId: item.id });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    logger.error('[Roadmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

