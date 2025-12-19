import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/strategy/versions
 * Get all strategy versions
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

    const { data: versions, error } = await adminClient
      .from('workspace_strategy')
      .select('id, version, status, vision_statement, created_at, updated_at')
      .eq('workspace_id', workspace.id)
      .order('version', { ascending: false });

    if (error) {
      logger.error('[Strategy API] Failed to fetch versions:', error);
      return internalError('Failed to fetch versions');
    }

    return NextResponse.json(versions || []);
  } catch (error) {
    logger.error('[Strategy API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

