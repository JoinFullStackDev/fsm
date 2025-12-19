import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/roadmap/prioritize
 * Get all items sorted by RICE score
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

    const { data: items, error } = await adminClient
      .from('workspace_roadmap_items')
      .select('*')
      .eq('workspace_id', workspace.id)
      .not('priority_score', 'is', null)
      .order('priority_score', { ascending: false });

    if (error) {
      logger.error('[Roadmap API] Failed to fetch prioritized items:', error);
      return internalError('Failed to fetch prioritized items');
    }

    return NextResponse.json(items || []);
  } catch (error) {
    logger.error('[Roadmap API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

