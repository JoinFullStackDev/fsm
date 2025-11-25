import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import type { ProjectPhase } from '@/types/phases';

// GET - List all phases for a project (ordered by display_order)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is project owner or member
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.owner_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      // Check if user is a project member
      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', currentUser.id)
        .single();

      if (!member) {
        return NextResponse.json({ error: 'Forbidden - Access denied' }, { status: 403 });
      }
    }

    // Fetch all active phases for the project
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      return NextResponse.json({ error: phasesError.message }, { status: 500 });
    }

    return NextResponse.json({ phases: phases || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new phase (admin or project owner only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is project owner or admin
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.owner_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Project owner or admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { phase_name, data, display_order } = body;

    if (!phase_name) {
      return NextResponse.json({ error: 'phase_name is required' }, { status: 400 });
    }

    // Get the highest phase_number and display_order for this project
    const { data: existingPhases, error: existingError } = await supabase
      .from('project_phases')
      .select('phase_number, display_order')
      .eq('project_id', params.id)
      .order('phase_number', { ascending: false })
      .limit(1);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
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

    // Create the new phase
    const { data: newPhase, error: createError } = await supabase
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
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(newPhase, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update phase metadata (name, order, data)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is project owner or admin
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.owner_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Project owner or admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { phase_id, phase_name, display_order, data, is_active } = body;

    if (!phase_id) {
      return NextResponse.json({ error: 'phase_id is required' }, { status: 400 });
    }

    // Build update object
    const updateData: Partial<ProjectPhase> = {};
    if (phase_name !== undefined) updateData.phase_name = phase_name;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (data !== undefined) updateData.data = data;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedPhase);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a phase (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is project owner or admin
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.owner_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Project owner or admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const phaseId = searchParams.get('phase_id');

    if (!phaseId) {
      return NextResponse.json({ error: 'phase_id query parameter is required' }, { status: 400 });
    }

    // Check if phase has associated tasks
    const { data: phase, error: phaseError } = await supabase
      .from('project_phases')
      .select('phase_number')
      .eq('id', phaseId)
      .eq('project_id', params.id)
      .single();

    if (phaseError || !phase) {
      return NextResponse.json({ error: 'Phase not found' }, { status: 404 });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('id')
      .eq('project_id', params.id)
      .eq('phase_number', phase.phase_number)
      .limit(1);

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
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
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
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
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Phase soft deleted successfully',
      phase: deletedPhase 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

