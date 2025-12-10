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
import type { UpdateDebtInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/debt/[debtId]
 * Get single debt item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; debtId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, debtId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(debtId)) {
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

    // Get debt item
    const { data: debtItem, error } = await adminClient
      .from('workspace_debt')
      .select('*')
      .eq('id', debtId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error || !debtItem) {
      return notFound('Debt item not found');
    }

    return NextResponse.json(debtItem);
  } catch (error) {
    logger.error('[Debt API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * PATCH /api/workspaces/[projectId]/debt/[debtId]
 * Update debt item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; debtId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, debtId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(debtId)) {
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

    // Verify debt item exists
    const { data: existingDebt } = await adminClient
      .from('workspace_debt')
      .select('id')
      .eq('id', debtId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!existingDebt) {
      return notFound('Debt item not found');
    }

    // Parse update data
    const body = await request.json();
    const updates: UpdateDebtInput = body;

    // Update debt item
    const { data: updatedDebt, error } = await adminClient
      .from('workspace_debt')
      .update(updates)
      .eq('id', debtId)
      .select()
      .single();

    if (error || !updatedDebt) {
      logger.error('[Debt API] Failed to update debt item:', error);
      return internalError('Failed to update debt item');
    }

    return NextResponse.json(updatedDebt);
  } catch (error) {
    logger.error('[Debt API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * DELETE /api/workspaces/[projectId]/debt/[debtId]
 * Delete debt item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; debtId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, debtId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(debtId)) {
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

    // Delete debt item
    const { error } = await adminClient
      .from('workspace_debt')
      .delete()
      .eq('id', debtId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Debt API] Failed to delete debt item:', error);
      return internalError('Failed to delete debt item');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Debt API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
