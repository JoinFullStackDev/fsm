import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; phaseNumber: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const phaseNumber = parseInt(params.phaseNumber, 10);
    if (phaseNumber < 1) {
      return NextResponse.json({ error: 'Invalid phase number' }, { status: 400 });
    }

    const { data: phase, error: phaseError } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', params.id)
      .eq('phase_number', phaseNumber)
      .single();

    if (phaseError || !phase) {
      return NextResponse.json({ error: 'Phase not found' }, { status: 404 });
    }

    return NextResponse.json(phase);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; phaseNumber: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const phaseNumber = parseInt(params.phaseNumber, 10);
    if (phaseNumber < 1) {
      return NextResponse.json({ error: 'Invalid phase number' }, { status: 400 });
    }

    // Get current user
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is project owner or member
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
      return NextResponse.json(
        { error: 'Forbidden - You must be a project member to edit phases' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { data: phaseData, completed } = body;

    const { data: phase, error: phaseError } = await supabase
      .from('project_phases')
      .update({
        data: phaseData,
        completed: completed || false,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', params.id)
      .eq('phase_number', phaseNumber)
      .select()
      .single();

    if (phaseError) {
      return NextResponse.json({ error: phaseError.message }, { status: 500 });
    }

    return NextResponse.json(phase);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

