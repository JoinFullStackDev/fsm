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
import type { CreateDecisionInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/decisions
 * List all decisions for a workspace
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

    // Get all decisions
    const { data: decisions, error } = await adminClient
      .from('workspace_decisions')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('decision_date', { ascending: false });

    if (error) {
      logger.error('[Decisions API] Failed to fetch decisions:', error);
      return internalError('Failed to fetch decisions');
    }

    return NextResponse.json(decisions || []);
  } catch (error) {
    logger.error('[Decisions API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/decisions
 * Create new decision
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

    // Parse request body
    const body = await request.json();
    const input: CreateDecisionInput = body;

    if (!input.title || !input.decision) {
      return badRequest('Title and decision are required');
    }

    // Create decision
    const { data: decision, error } = await adminClient
      .from('workspace_decisions')
      .insert({
        workspace_id: workspace.id,
        title: input.title,
        context: input.context || null,
        decision: input.decision,
        rationale: input.rationale || null,
        options_considered: input.options_considered || [],
        chosen_option: input.chosen_option || null,
        constraints: input.constraints || [],
        tradeoffs: input.tradeoffs || null,
        linked_clarity_spec_id: input.linked_clarity_spec_id || null,
        linked_epic_draft_id: input.linked_epic_draft_id || null,
        decision_date: input.decision_date || new Date().toISOString().split('T')[0],
        decided_by: input.decided_by || [user.id],
        tags: input.tags || [],
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !decision) {
      logger.error('[Decisions API] Failed to create decision:', error);
      return internalError('Failed to create decision');
    }

    logger.info('[Decisions API] Created decision:', {
      decisionId: decision.id,
      workspaceId: workspace.id,
      title: decision.title,
    });

    return NextResponse.json(decision);
  } catch (error) {
    logger.error('[Decisions API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
