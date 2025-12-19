import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { UpdateReleaseInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string; releaseId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, releaseId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(releaseId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: release, error } = await adminClient.from('workspace_releases').select('*').eq('id', releaseId).eq('workspace_id', workspace.id).single();
    if (error || !release) return notFound('Release not found');

    return NextResponse.json(release);
  } catch (error) {
    logger.error('[Releases API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; releaseId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, releaseId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(releaseId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { data: existing } = await adminClient.from('workspace_releases').select('id').eq('id', releaseId).eq('workspace_id', workspace.id).single();
    if (!existing) return notFound('Release not found');

    const body = await request.json() as UpdateReleaseInput;

    const { data: release, error } = await adminClient.from('workspace_releases').update({
      ...(body.release_name !== undefined && { release_name: body.release_name }),
      ...(body.release_type !== undefined && { release_type: body.release_type }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.release_goals !== undefined && { release_goals: body.release_goals }),
      ...(body.target_audience !== undefined && { target_audience: body.target_audience }),
      ...(body.included_roadmap_item_ids !== undefined && { included_roadmap_item_ids: body.included_roadmap_item_ids }),
      ...(body.feature_flags !== undefined && { feature_flags: body.feature_flags }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.planned_date !== undefined && { planned_date: body.planned_date }),
      ...(body.actual_date !== undefined && { actual_date: body.actual_date }),
    }).eq('id', releaseId).select().single();

    if (error) {
      logger.error('[Releases API] Failed to update release:', error);
      return internalError('Failed to update release');
    }

    logger.info('[Releases API] Release updated:', { releaseId });
    return NextResponse.json(release);
  } catch (error) {
    logger.error('[Releases API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; releaseId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId, releaseId } = params;
    if (!isValidUUID(projectId) || !isValidUUID(releaseId)) return badRequest('Invalid ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { error } = await adminClient.from('workspace_releases').delete().eq('id', releaseId).eq('workspace_id', workspace.id);
    if (error) {
      logger.error('[Releases API] Failed to delete release:', error);
      return internalError('Failed to delete release');
    }

    logger.info('[Releases API] Release deleted:', { releaseId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Releases API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

