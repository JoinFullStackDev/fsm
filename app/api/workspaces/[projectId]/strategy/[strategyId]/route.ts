import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { UpdateStrategyInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string; strategyId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, strategyId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(strategyId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: strategy, error } = await adminClient.from('workspace_strategy').select('*').eq('id', strategyId).eq('workspace_id', workspace.id).single();
    if (error || !strategy) return notFound('Strategy not found');

    return NextResponse.json(strategy);
  } catch (error) {
    logger.error('[Strategy API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; strategyId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, strategyId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(strategyId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: existing } = await adminClient.from('workspace_strategy').select('id').eq('id', strategyId).eq('workspace_id', workspace.id).single();
    if (!existing) return notFound('Strategy not found');

    const body = await request.json() as UpdateStrategyInput;

    const { data: strategy, error } = await adminClient.from('workspace_strategy').update({
      ...(body.north_star_metric !== undefined && { north_star_metric: body.north_star_metric }),
      ...(body.north_star_definition !== undefined && { north_star_definition: body.north_star_definition }),
      ...(body.input_metrics !== undefined && { input_metrics: body.input_metrics }),
      ...(body.vision_statement !== undefined && { vision_statement: body.vision_statement }),
      ...(body.strategic_narrative !== undefined && { strategic_narrative: body.strategic_narrative }),
      ...(body.timeline_horizon !== undefined && { timeline_horizon: body.timeline_horizon }),
      ...(body.design_principles !== undefined && { design_principles: body.design_principles }),
      ...(body.product_values !== undefined && { product_values: body.product_values }),
      ...(body.anti_patterns !== undefined && { anti_patterns: body.anti_patterns }),
      ...(body.market_position !== undefined && { market_position: body.market_position }),
      ...(body.differentiation_strategy !== undefined && { differentiation_strategy: body.differentiation_strategy }),
      ...(body.competitor_matrix !== undefined && { competitor_matrix: body.competitor_matrix }),
      ...(body.strategic_bets !== undefined && { strategic_bets: body.strategic_bets }),
      ...(body.investment_areas !== undefined && { investment_areas: body.investment_areas }),
      ...(body.status !== undefined && { status: body.status }),
    }).eq('id', strategyId).select().single();

    if (error) {
      logger.error('[Strategy API] Failed to update strategy:', error);
      return internalError('Failed to update strategy');
    }

    logger.info('[Strategy API] Strategy updated:', { strategyId });
    return NextResponse.json(strategy);
  } catch (error) {
    logger.error('[Strategy API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; strategyId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, strategyId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(strategyId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { error } = await adminClient.from('workspace_strategy').delete().eq('id', strategyId).eq('workspace_id', workspace.id);
    if (error) {
      logger.error('[Strategy API] Failed to delete strategy:', error);
      return internalError('Failed to delete strategy');
    }

    logger.info('[Strategy API] Strategy deleted:', { strategyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Strategy API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

