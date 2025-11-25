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

