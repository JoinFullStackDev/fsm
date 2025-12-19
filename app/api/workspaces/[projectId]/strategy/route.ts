import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateStrategyInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/strategy
 * Get current active strategy or latest version
 */
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

    // Get active strategy or latest version
    const { data: strategy, error } = await adminClient
      .from('workspace_strategy')
      .select('*')
      .eq('workspace_id', workspace.id)
      .or('status.eq.active,status.eq.draft')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error('[Strategy API] Failed to fetch strategy:', error);
      return internalError('Failed to fetch strategy');
    }

    return NextResponse.json(strategy || null);
  } catch (error) {
    logger.error('[Strategy API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/strategy
 * Create or update strategy (versioned)
 */
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

    const body = await request.json() as CreateStrategyInput;

    // Get latest version number
    const { data: latestStrategy } = await adminClient
      .from('workspace_strategy')
      .select('version')
      .eq('workspace_id', workspace.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = latestStrategy ? latestStrategy.version + 1 : 1;

    // Create new strategy version
    const { data: strategy, error } = await adminClient.from('workspace_strategy').insert({
      workspace_id: workspace.id,
      version: nextVersion,
      north_star_metric: body.north_star_metric || null,
      north_star_definition: body.north_star_definition || null,
      input_metrics: body.input_metrics || [],
      vision_statement: body.vision_statement || null,
      strategic_narrative: body.strategic_narrative || null,
      timeline_horizon: body.timeline_horizon || null,
      design_principles: body.design_principles || [],
      product_values: body.product_values || [],
      anti_patterns: body.anti_patterns || [],
      market_position: body.market_position || null,
      differentiation_strategy: body.differentiation_strategy || null,
      competitor_matrix: body.competitor_matrix || {},
      strategic_bets: body.strategic_bets || [],
      investment_areas: body.investment_areas || {},
      status: 'active',
      created_by: userRecord?.id || null,
    }).select().single();

    if (error) {
      logger.error('[Strategy API] Failed to create strategy:', error);
      return internalError('Failed to create strategy');
    }

    // Archive previous active strategies
    await adminClient
      .from('workspace_strategy')
      .update({ status: 'archived' })
      .eq('workspace_id', workspace.id)
      .neq('id', strategy.id)
      .eq('status', 'active');

    logger.info('[Strategy API] Strategy created:', { strategyId: strategy.id, version: nextVersion });
    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    logger.error('[Strategy API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

