import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; phaseNumber: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view project phases');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const phaseNumber = parseInt(params.phaseNumber, 10);
    if (phaseNumber < 1) {
      return badRequest('Invalid phase number');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Phase GET] User not found:', userError);
      return notFound('User not found');
    }

    // Verify user has access to the project - Use admin client to avoid RLS recursion
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('owner_id, organization_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Validate organization access (super admins can see all projects)
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    if (!isSuperAdmin && project.organization_id !== organizationId) {
      // Check if user is a project member
      const { data: member } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();

      if (!member) {
        return forbidden('You do not have access to this project');
      }
    }

    // Fetch the phase - Use admin client and filter by is_active to avoid multiple results
    const { data: phase, error: phaseError } = await adminClient
      .from('project_phases')
      .select('*')
      .eq('project_id', params.id)
      .eq('phase_number', phaseNumber)
      .eq('is_active', true)
      .single();

    if (phaseError) {
      if (phaseError.code === 'PGRST116') {
        return notFound('Phase not found');
      }
      logger.error('[Phase GET] Error loading phase:', phaseError);
      return internalError('Failed to load phase', { error: phaseError.message });
    }

    if (!phase) {
      return notFound('Phase not found');
    }

    return NextResponse.json(phase);
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/phases/[phaseNumber]:', error);
    return internalError('Failed to load phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; phaseNumber: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update project phases');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const phaseNumber = parseInt(params.phaseNumber, 10);
    if (phaseNumber < 1) {
      return badRequest('Invalid phase number');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Phase PUT] User not found:', userError);
      return notFound('User not found');
    }

    // Verify user has access to the project - Use admin client to avoid RLS recursion
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('owner_id, organization_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Validate organization access (super admins can access all projects)
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    if (!isSuperAdmin && project.organization_id !== organizationId) {
      // Check if user is a project member
      const { data: member } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();

      if (!member) {
        return forbidden('You do not have access to this project');
      }
    }

    const isOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';

    // Check if user is a project member
    const { data: projectMember } = await adminClient
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', userData.id)
      .single();

    const isProjectMember = isOwner || !!projectMember || isAdmin;

    if (!isProjectMember) {
      return forbidden('You must be a project member to edit phases');
    }

    const body = await request.json();
    const { data: phaseData, completed } = body;

    // Update the phase - Use admin client and filter by is_active
    const { data: phase, error: phaseError } = await adminClient
      .from('project_phases')
      .update({
        data: phaseData,
        completed: completed || false,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', params.id)
      .eq('phase_number', phaseNumber)
      .eq('is_active', true)
      .select()
      .single();

    if (phaseError) {
      if (phaseError.code === 'PGRST116') {
        return notFound('Phase not found');
      }
      logger.error('[Phase PUT] Error updating phase:', phaseError);
      return internalError('Failed to update phase', { error: phaseError.message });
    }

    if (!phase) {
      return notFound('Phase not found');
    }

    return NextResponse.json(phase);
  } catch (error) {
    logger.error('Error in PUT /api/projects/[id]/phases/[phaseNumber]:', error);
    return internalError('Failed to update phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

