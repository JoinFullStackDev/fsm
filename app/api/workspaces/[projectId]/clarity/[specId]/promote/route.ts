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

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/clarity/[specId]/promote
 * Mark clarity spec as ready for review/epic generation
 */
export async function POST(
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
    const { data: spec } = await adminClient
      .from('clarity_specs')
      .select('*')
      .eq('id', specId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!spec) {
      return notFound('Clarity spec not found');
    }

    // Parse request body for target status
    const body = await request.json();
    const { status } = body;

    if (!status || !['in_review', 'ready'].includes(status)) {
      return badRequest('Invalid status. Must be "in_review" or "ready"');
    }

    // Update status
    const { data: updatedSpec, error } = await adminClient
      .from('clarity_specs')
      .update({ status })
      .eq('id', specId)
      .select()
      .single();

    if (error || !updatedSpec) {
      logger.error('[Clarity Promote API] Failed to update status:', error);
      return internalError('Failed to promote clarity spec');
    }

    // Set as active spec if promoting to ready
    if (status === 'ready') {
      await adminClient
        .from('project_workspaces')
        .update({ active_clarity_spec_id: specId })
        .eq('id', workspace.id);
    }

    logger.info('[Clarity Promote API] Spec promoted:', {
      specId,
      status,
    });

    return NextResponse.json(updatedSpec);
  } catch (error) {
    logger.error('[Clarity Promote API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
