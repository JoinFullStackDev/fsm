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
import type { UpdateClaritySpecInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/clarity/[specId]
 * Get single clarity spec
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; specId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, specId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(specId)) {
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

    // Get spec
    const { data: spec, error } = await adminClient
      .from('clarity_specs')
      .select('*')
      .eq('id', specId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error || !spec) {
      return notFound('Clarity spec not found');
    }

    return NextResponse.json(spec);
  } catch (error) {
    logger.error('[Clarity API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * PATCH /api/workspaces/[projectId]/clarity/[specId]
 * Update clarity spec (auto-save)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; specId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, specId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(specId)) {
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

    // Verify spec exists
    const { data: existingSpec } = await adminClient
      .from('clarity_specs')
      .select('id')
      .eq('id', specId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!existingSpec) {
      return notFound('Clarity spec not found');
    }

    // Parse update data
    const body = await request.json();
    const updates: UpdateClaritySpecInput = body;

    // Update spec
    const { data: updatedSpec, error } = await adminClient
      .from('clarity_specs')
      .update(updates)
      .eq('id', specId)
      .select()
      .single();

    if (error || !updatedSpec) {
      logger.error('[Clarity API] Failed to update spec:', error);
      return internalError('Failed to update clarity spec');
    }

    return NextResponse.json(updatedSpec);
  } catch (error) {
    logger.error('[Clarity API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * DELETE /api/workspaces/[projectId]/clarity/[specId]
 * Delete (archive) clarity spec
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; specId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, specId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(specId)) {
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
      .select('id, active_clarity_spec_id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Archive the spec instead of deleting
    const { error } = await adminClient
      .from('clarity_specs')
      .update({ status: 'archived' })
      .eq('id', specId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Clarity API] Failed to archive spec:', error);
      return internalError('Failed to archive clarity spec');
    }

    // If this was the active spec, clear it
    if (workspace.active_clarity_spec_id === specId) {
      await adminClient
        .from('project_workspaces')
        .update({ active_clarity_spec_id: null })
        .eq('id', workspace.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Clarity API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
