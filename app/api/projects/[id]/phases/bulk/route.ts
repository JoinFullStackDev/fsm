import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// POST - Create multiple phases at once (bulk insert)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to create project phases');
    }

    // Use admin client to bypass RLS for all database operations
    const adminClient = createAdminSupabaseClient();

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get current user
    const { data: currentUser, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User not found');
    }

    // Verify user is project owner, member, or admin
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('owner_id, organization_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Validate organization access (super admins can access all projects)
    if (currentUser.role !== 'admin' || currentUser.is_super_admin !== true) {
      if (project.organization_id !== organizationId) {
        return forbidden('You do not have access to this project');
      }
    }

    const isOwner = project.owner_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    // Check if user is a project member
    const { data: projectMember } = await adminClient
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    const isProjectMember = isOwner || !!projectMember || isAdmin;

    if (!isProjectMember) {
      return forbidden('Project owner, member, or admin access required');
    }

    const body = await request.json();
    const { phases } = body;

    if (!Array.isArray(phases) || phases.length === 0) {
      return badRequest('phases array is required and must not be empty');
    }

    // Validate each phase has required fields
    for (const phase of phases) {
      if (!phase.project_id || phase.project_id !== params.id) {
        return badRequest('All phases must have project_id matching the URL parameter');
      }
      if (!phase.phase_number || typeof phase.phase_number !== 'number') {
        return badRequest('All phases must have a valid phase_number');
      }
      if (!phase.phase_name || typeof phase.phase_name !== 'string') {
        return badRequest('All phases must have a valid phase_name');
      }
    }

    // Insert all phases using admin client to bypass RLS
    const { data: insertedPhases, error: insertError } = await adminClient
      .from('project_phases')
      .insert(phases)
      .select();

    if (insertError) {
      logger.error('Error creating phases in bulk:', insertError);
      return internalError('Failed to create phases', { error: insertError.message });
    }

    return NextResponse.json({ phases: insertedPhases }, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/phases/bulk:', error);
    return internalError('Failed to create phases', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

