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
import type { UpdateDecisionInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/decisions/[decisionId]
 * Get single decision
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; decisionId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, decisionId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(decisionId)) {
      return badRequest('Invalid ID format');
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

    // Get decision
    const { data: decision, error } = await adminClient
      .from('workspace_decisions')
      .select('*')
      .eq('id', decisionId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error || !decision) {
      return notFound('Decision not found');
    }

    return NextResponse.json(decision);
  } catch (error) {
    logger.error('[Decisions API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * PATCH /api/workspaces/[projectId]/decisions/[decisionId]
 * Update decision
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; decisionId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, decisionId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(decisionId)) {
      return badRequest('Invalid ID format');
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

    // Verify decision exists
    const { data: existingDecision } = await adminClient
      .from('workspace_decisions')
      .select('id')
      .eq('id', decisionId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!existingDecision) {
      return notFound('Decision not found');
    }

    // Parse update data
    const body = await request.json();
    const updates: UpdateDecisionInput = body;

    // Update decision
    const { data: updatedDecision, error } = await adminClient
      .from('workspace_decisions')
      .update(updates)
      .eq('id', decisionId)
      .select()
      .single();

    if (error || !updatedDecision) {
      logger.error('[Decisions API] Failed to update decision:', error);
      return internalError('Failed to update decision');
    }

    return NextResponse.json(updatedDecision);
  } catch (error) {
    logger.error('[Decisions API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * DELETE /api/workspaces/[projectId]/decisions/[decisionId]
 * Delete decision
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; decisionId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, decisionId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(decisionId)) {
      return badRequest('Invalid ID format');
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

    // Delete decision
    const { error } = await adminClient
      .from('workspace_decisions')
      .delete()
      .eq('id', decisionId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Decisions API] Failed to delete decision:', error);
      return internalError('Failed to delete decision');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Decisions API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
