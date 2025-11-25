import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const templateId = params.id;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load template
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Load field configs
    const { data: fieldConfigs, error: configsError } = await supabase
      .from('template_field_configs')
      .select('*')
      .eq('template_id', templateId)
      .order('phase_number', { ascending: true })
      .order('display_order', { ascending: true });

    if (configsError) {
      return NextResponse.json(
        { error: `Failed to load field configs: ${configsError.message}` },
        { status: 500 }
      );
    }

    // Load template phases
    const { data: templatePhases, error: phasesError } = await supabase
      .from('template_phases')
      .select('*')
      .eq('template_id', templateId)
      .order('phase_number', { ascending: true });

    if (phasesError) {
      return NextResponse.json(
        { error: `Failed to load template phases: ${phasesError.message}` },
        { status: 500 }
      );
    }

    // Organize export data
    const exportData = {
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        is_public: template.is_public,
        version: template.version || '1.0.0',
        created_at: template.created_at,
        updated_at: template.updated_at,
      },
      phases: templatePhases?.map(phase => ({
        phase_number: phase.phase_number,
        data: phase.data,
      })) || [],
      field_configs: fieldConfigs?.map(config => ({
        phase_number: config.phase_number,
        field_key: config.field_key,
        field_type: config.field_type,
        display_order: config.display_order,
        layout_config: config.layout_config,
        field_config: config.field_config,
        conditional_logic: config.conditional_logic,
        group_id: config.group_id,
      })) || [],
      exported_at: new Date().toISOString(),
    };

    // Return as JSON download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="template_${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

