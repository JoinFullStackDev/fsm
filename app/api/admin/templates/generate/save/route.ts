import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

interface GeneratedTemplate {
  template: {
    name: string;
    description: string;
    category?: string;
    is_public?: boolean;
  };
  phases: Array<{
    phase_number: number;
    phase_name: string;
    display_order: number;
  }>;
  field_configs: Array<{
    phase_number: number;
    field_key: string;
    field_type: string;
    display_order: number;
    layout_config: {
      columns: number;
      spacing?: number;
    };
    field_config: {
      label: string;
      helpText?: string;
      placeholder?: string;
      required?: boolean;
      aiSettings?: {
        enabled: boolean;
      };
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Allow admins and PMs to save generated templates
    if (userData.role !== 'admin' && userData.role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden - Admin or PM access required' }, { status: 403 });
    }

    const body = await request.json() as GeneratedTemplate;

    // Validate structure
    if (!body.template || !body.phases || !body.field_configs) {
      return NextResponse.json(
        { error: 'Invalid template structure' },
        { status: 400 }
      );
    }

    // Create template record
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .insert({
        name: body.template.name,
        description: body.template.description,
        category: body.template.category || null,
        created_by: userData.id,
        is_public: body.template.is_public || false,
        version: '1.0.0',
      })
      .select()
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: `Failed to create template: ${templateError?.message}` },
        { status: 500 }
      );
    }

    // Create template phases
    const phaseInserts = body.phases.map((phase) => ({
      template_id: template.id,
      phase_number: phase.phase_number,
      phase_name: phase.phase_name,
      display_order: phase.display_order,
      data: {},
      is_active: true,
    }));

    const { error: phasesError } = await supabase
      .from('template_phases')
      .insert(phaseInserts);

    if (phasesError) {
      // Rollback: delete template
      await supabase.from('project_templates').delete().eq('id', template.id);
      return NextResponse.json(
        { error: `Failed to create template phases: ${phasesError.message}` },
        { status: 500 }
      );
    }

    // Create field configs
    const fieldConfigInserts = body.field_configs.map((field) => ({
      template_id: template.id,
      phase_number: field.phase_number,
      field_key: field.field_key,
      field_type: field.field_type,
      display_order: field.display_order,
      layout_config: field.layout_config,
      field_config: field.field_config,
      conditional_logic: null,
      group_id: null,
    }));

    if (fieldConfigInserts.length > 0) {
      const { error: configsError } = await supabase
        .from('template_field_configs')
        .insert(fieldConfigInserts);

      if (configsError) {
        // Rollback: delete template and phases
        await supabase.from('template_phases').delete().eq('template_id', template.id);
        await supabase.from('project_templates').delete().eq('id', template.id);
        return NextResponse.json(
          { error: `Failed to create field configs: ${configsError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      templateId: template.id,
      message: 'Template created successfully',
    });
  } catch (error) {
    console.error('Save template error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save template',
      },
      { status: 500 }
    );
  }
}

