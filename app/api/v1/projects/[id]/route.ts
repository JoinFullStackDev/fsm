import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/apiKeyAuth';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/projects/[id]
 * Get project (API key auth)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate API key
    const apiKeyContext = await requireApiKeyAuth(request);

    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('projects')
      .select('id, name, description, status, company_id, owner_id, created_at, updated_at')
      .eq('id', params.id);

    // Apply organization filter for org-scoped keys
    if (apiKeyContext.scope === 'org' && apiKeyContext.organizationId) {
      query = query.eq('organization_id', apiKeyContext.organizationId);
    }

    const { data: project, error } = await query.single();

    if (error || !project) {
      return notFound('Project not found');
    }

    return NextResponse.json(project);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse; // Already a NextResponse error
    }
    logger.error('[API v1] Error fetching project:', error);
    return internalError('Failed to fetch project');
  }
}

/**
 * PUT /api/v1/projects/[id]
 * Update project (requires write permission)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate API key
    const apiKeyContext = await requireApiKeyAuth(request);

    // Check write permission
    if (apiKeyContext.permissions !== 'write') {
      return forbidden('Write permission required');
    }

    const body = await request.json();
    const { name, description, status } = body;

    // Get existing project to verify access
    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('projects')
      .select('id, organization_id')
      .eq('id', params.id);

    if (apiKeyContext.scope === 'org' && apiKeyContext.organizationId) {
      query = query.eq('organization_id', apiKeyContext.organizationId);
    }

    const { data: existingProject, error: fetchError } = await query.single();

    if (fetchError || !existingProject) {
      return notFound('Project not found');
    }

    // Build update object
    const updates: Record<string, string | undefined> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return unauthorized('No fields to update');
    }

    // Update project
    const { data: updatedProject, error: updateError } = await adminClient
      .from('projects')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, description, status, company_id, owner_id, created_at, updated_at')
      .single();

    if (updateError || !updatedProject) {
      logger.error('[API v1] Error updating project:', updateError);
      return internalError('Failed to update project');
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse; // Already a NextResponse error
    }
    logger.error('[API v1] Error updating project:', error);
    return internalError('Failed to update project');
  }
}

