import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectPhase } from '@/types/phases';

// GET - List all phases for a project (ordered by display_order)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: currentUser, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !currentUser) {
      logger.error('[Project Phases GET] User not found:', userError);
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
    const isSuperAdmin = currentUser.role === 'admin' && currentUser.is_super_admin === true;
    if (!isSuperAdmin && project.organization_id !== organizationId) {
      // Check if user is a project member
      const { data: member } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', currentUser.id)
        .single();

      if (!member) {
        return forbidden('You do not have access to this project');
      }
    }

    // Fetch all active phases for the project - Use admin client to avoid RLS recursion
    const { data: phases, error: phasesError } = await adminClient
      .from('project_phases')
      .select('*')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      logger.error('Error loading phases:', phasesError);
      return internalError('Failed to load project phases', { error: phasesError.message });
    }

    return NextResponse.json({ phases: phases || [] });
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/phases:', error);
    return internalError('Failed to load project phases', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST - Create a new phase (admin, project owner, or project member)
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
    const { phase_name, data, display_order } = body;

    if (!phase_name) {
      return badRequest('phase_name is required');
    }

    // Get the highest phase_number and display_order for this project
    const { data: existingPhases, error: existingError } = await adminClient
      .from('project_phases')
      .select('phase_number, display_order')
      .eq('project_id', params.id)
      .order('phase_number', { ascending: false })
      .limit(1);

    if (existingError) {
      logger.error('Error loading existing phases:', existingError);
      return internalError('Failed to load existing phases', { error: existingError.message });
    }

    // Calculate next phase_number and display_order
    const nextPhaseNumber = existingPhases && existingPhases.length > 0
      ? existingPhases[0].phase_number + 1
      : 1;
    
    const nextDisplayOrder = display_order !== undefined
      ? display_order
      : (existingPhases && existingPhases.length > 0
          ? existingPhases[0].display_order + 1
          : 1);

    // Create the new phase using admin client to bypass RLS
    const { data: newPhase, error: createError } = await adminClient
      .from('project_phases')
      .insert({
        project_id: params.id,
        phase_number: nextPhaseNumber,
        phase_name,
        display_order: nextDisplayOrder,
        data: data || {},
        completed: false,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating phase:', createError);
      return internalError('Failed to create phase', { error: createError.message });
    }

    return NextResponse.json(newPhase, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/phases:', error);
    return internalError('Failed to create phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// PATCH - Update phase metadata (name, order, data)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Get current user
    let currentUser;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', user.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User not found');
      }

      currentUser = adminUserData;
    } else {
      currentUser = regularUserData;
    }

    // Verify user is project owner, member, or admin
    const { data: project, error: projectError } = await supabase
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
    const { data: projectMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', currentUser.id)
      .single();

    const isProjectMember = isOwner || !!projectMember || isAdmin;

    if (!isProjectMember) {
      return forbidden('Project owner, member, or admin access required');
    }

    const body = await request.json();
    const { phase_id, phase_name, display_order, data, is_active } = body;

    if (!phase_id) {
      return badRequest('phase_id is required');
    }

    // Build update object
    const updateData: Partial<ProjectPhase> = {};
    if (phase_name !== undefined) updateData.phase_name = phase_name;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (data !== undefined) updateData.data = data;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return badRequest('No fields to update');
    }

    // Update the phase
    const { data: updatedPhase, error: updateError } = await supabase
      .from('project_phases')
      .update(updateData)
      .eq('id', phase_id)
      .eq('project_id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating phase:', updateError);
      return internalError('Failed to update phase', { error: updateError.message });
    }

    return NextResponse.json(updatedPhase);
  } catch (error) {
    logger.error('Error in PATCH /api/projects/[id]/phases:', error);
    return internalError('Failed to update phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DELETE - Soft delete a phase (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to delete project phases');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get current user
    let currentUser;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', user.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User not found');
      }

      currentUser = adminUserData;
    } else {
      currentUser = regularUserData;
    }

    // Verify user is project owner or admin
    const { data: project, error: projectError } = await supabase
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

    if (!isOwner && !isAdmin) {
      return forbidden('Project owner or admin access required');
    }

    const { searchParams } = new URL(request.url);
    const phaseId = searchParams.get('phase_id');

    if (!phaseId) {
      return badRequest('phase_id query parameter is required');
    }

    // Check if phase has associated tasks
    const { data: phase, error: phaseError } = await supabase
      .from('project_phases')
      .select('phase_number')
      .eq('id', phaseId)
      .eq('project_id', params.id)
      .single();

    if (phaseError || !phase) {
      return notFound('Phase not found');
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('id')
      .eq('project_id', params.id)
      .eq('phase_number', phase.phase_number)
      .limit(1);

    if (tasksError) {
      logger.error('Error checking phase tasks:', tasksError);
      return internalError('Failed to check phase tasks', { error: tasksError.message });
    }

    // Warn if tasks exist, but still allow soft delete
    if (tasks && tasks.length > 0) {
      // Soft delete by setting is_active = false
      const { data: deletedPhase, error: deleteError } = await supabase
        .from('project_phases')
        .update({ is_active: false })
        .eq('id', phaseId)
        .eq('project_id', params.id)
        .select()
        .single();

      if (deleteError) {
        logger.error('Error deleting phase:', deleteError);
        return internalError('Failed to delete phase', { error: deleteError.message });
      }

      return NextResponse.json({ 
        message: 'Phase soft deleted successfully (has associated tasks)',
        phase: deletedPhase,
        warning: 'This phase has associated tasks. Tasks will retain their phase_number reference.'
      });
    }

    // Soft delete by setting is_active = false
    const { data: deletedPhase, error: deleteError } = await supabase
      .from('project_phases')
      .update({ is_active: false })
      .eq('id', phaseId)
      .eq('project_id', params.id)
      .select()
      .single();

    if (deleteError) {
      logger.error('Error deleting phase:', deleteError);
      return internalError('Failed to delete phase', { error: deleteError.message });
    }

    return NextResponse.json({ 
      message: 'Phase soft deleted successfully',
      phase: deletedPhase 
    });
  } catch (error) {
    logger.error('Error in DELETE /api/projects/[id]/phases:', error);
    return internalError('Failed to delete phase', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

