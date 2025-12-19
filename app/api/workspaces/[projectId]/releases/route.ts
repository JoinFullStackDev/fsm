import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateReleaseInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

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

    const { data: releases, error } = await adminClient
      .from('workspace_releases')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('planned_date', { ascending: false });

    if (error) {
      logger.error('[Releases API] Failed to fetch releases:', error);
      return internalError('Failed to fetch releases');
    }

    return NextResponse.json(releases || []);
  } catch (error) {
    logger.error('[Releases API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

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

    const body = await request.json() as CreateReleaseInput;
    if (!body.release_name || !body.release_type) return badRequest('Release name and type are required');

    const { data: release, error } = await adminClient.from('workspace_releases').insert({
      workspace_id: workspace.id,
      release_name: body.release_name,
      release_type: body.release_type,
      description: body.description || null,
      release_goals: body.release_goals || [],
      target_audience: body.target_audience || null,
      planned_date: body.planned_date || null,
      created_by: userRecord?.id || null,
    }).select().single();

    if (error) {
      logger.error('[Releases API] Failed to create release:', error);
      return internalError('Failed to create release');
    }

    logger.info('[Releases API] Release created:', { releaseId: release.id });
    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    logger.error('[Releases API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

