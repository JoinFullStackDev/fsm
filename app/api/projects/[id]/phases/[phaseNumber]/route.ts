import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { cacheDel, CACHE_KEYS } from '@/lib/cache/unifiedCache';
import logger from '@/lib/utils/logger';
import { isValidUUID } from '@/lib/utils/inputSanitization';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch a specific phase's data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; phaseNumber: string } }
) {
  try {
    const projectId = params.id;
    const phaseNumber = parseInt(params.phaseNumber, 10);

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID format');
    }

    if (isNaN(phaseNumber) || phaseNumber < 1) {
      return badRequest('Invalid phase number');
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view this phase');
    }

    const adminClient = createAdminSupabaseClient();

    // Get user info
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Get project to verify access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, owner_id, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Check access
    const isOwner = project.owner_id === userData.id;
    const isSuperAdmin = userData.is_super_admin === true;
    const isOrgMember = project.organization_id === userData.organization_id;

    if (!isOwner && !isSuperAdmin && !isOrgMember) {
      // Check if member
      const { data: membership } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .single();

      if (!membership) {
        return forbidden('You do not have access to this project');
      }
    }

    // Get phase data
    const { data: phase, error: phaseError } = await adminClient
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .eq('phase_number', phaseNumber)
      .single();

    if (phaseError || !phase) {
      return notFound('Phase not found');
    }

    return NextResponse.json(phase);
  } catch (error) {
    logger.error('[Phase API GET] Unexpected error:', error);
    return internalError('Failed to fetch phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT - Update a specific phase's data
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; phaseNumber: string } }
) {
  try {
    const projectId = params.id;
    const phaseNumber = parseInt(params.phaseNumber, 10);

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID format');
    }

    if (isNaN(phaseNumber) || phaseNumber < 1) {
      return badRequest('Invalid phase number');
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update this phase');
    }

    const body = await request.json();
    const { data: phaseData, completed } = body;

    if (phaseData === undefined) {
      return badRequest('Phase data is required');
    }

    const adminClient = createAdminSupabaseClient();

    // Get user info
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Get project to verify access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, owner_id, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Check write access (owner, super admin, or project member with edit role)
    const isOwner = project.owner_id === userData.id;
    const isSuperAdmin = userData.is_super_admin === true;
    const isAdmin = userData.role === 'admin';

    let hasWriteAccess = isOwner || isSuperAdmin || isAdmin;

    if (!hasWriteAccess) {
      // Check if member with edit permissions
      const { data: membership } = await adminClient
        .from('project_members')
        .select('id, role')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .single();

      if (membership) {
        // Project members can edit phases (you can make this more granular if needed)
        hasWriteAccess = true;
      }
    }

    if (!hasWriteAccess) {
      return forbidden('You do not have permission to update this phase');
    }

    // Verify phase exists
    const { data: existingPhase, error: phaseCheckError } = await adminClient
      .from('project_phases')
      .select('id')
      .eq('project_id', projectId)
      .eq('phase_number', phaseNumber)
      .single();

    if (phaseCheckError || !existingPhase) {
      return notFound('Phase not found');
    }

    // Update the phase
    const updatePayload: Record<string, unknown> = {
      data: phaseData,
      updated_at: new Date().toISOString(),
    };

    if (completed !== undefined) {
      updatePayload.completed = completed;
    }

    logger.debug('[Phase API PUT] Updating phase:', {
      projectId,
      phaseNumber,
      dataKeys: Object.keys(phaseData || {}),
      completed,
    });

    const { data: updatedPhase, error: updateError } = await adminClient
      .from('project_phases')
      .update(updatePayload)
      .eq('project_id', projectId)
      .eq('phase_number', phaseNumber)
      .select()
      .single();

    if (updateError) {
      logger.error('[Phase API PUT] Update error:', updateError);
      return internalError('Failed to update phase', {
        error: updateError.message,
      });
    }

    // Invalidate phase-related caches after successful update
    try {
      await Promise.all([
        cacheDel(CACHE_KEYS.projectPhases(projectId)),
        cacheDel(CACHE_KEYS.projectPhase(projectId, phaseNumber)),
      ]);
      logger.debug('[Phase API PUT] Cache invalidated for project:', projectId);
    } catch (cacheError) {
      logger.warn('[Phase API PUT] Failed to invalidate cache:', cacheError);
    }

    logger.debug('[Phase API PUT] Phase updated successfully');

    return NextResponse.json(updatedPhase);
  } catch (error) {
    logger.error('[Phase API PUT] Unexpected error:', error);
    return internalError('Failed to update phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
