import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateCursorMasterPrompt } from '@/lib/exportHandlers/cursorBundle';
import { generateCursorZip } from '@/lib/exportHandlers/zipGenerator';
import type { Project } from '@/types/project';

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

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all phases
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', params.id)
      .order('phase_number', { ascending: true });

    if (phasesError) {
      return NextResponse.json({ error: phasesError.message }, { status: 500 });
    }

    // Organize phases by number
    const phaseMap: Record<number, any> = {};
    phases?.forEach((phase) => {
      phaseMap[phase.phase_number] = phase.data;
    });

    // Generate cursor master prompt
    const prompt = generateCursorMasterPrompt(project as Project, {
      phase1: phaseMap[1],
      phase2: phaseMap[2],
      phase3: phaseMap[3],
      phase4: phaseMap[4],
      phase5: phaseMap[5],
      phase6: phaseMap[6],
    });

    // Generate ZIP file
    const zipBlob = await generateCursorZip(prompt, project.name);
    const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());

    // Get user record for tracking
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    // Record export with user_id and file_size (backward compatible)
    const exportData: any = {
      project_id: params.id,
      export_type: 'cursor_bundle',
      storage_path: null,
    };

    // Add optional fields if columns exist
    if (userData?.id) {
      exportData.user_id = userData.id;
    }
    exportData.file_size = zipBuffer.length;

    await supabase.from('exports').insert(exportData);

    // Return ZIP file
    const sanitizedName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedName}_cursor_bundle.zip"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

