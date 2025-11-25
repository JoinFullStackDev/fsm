import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const templateId = params.id;
    const body = await request.json();
    const newName = body.name || null;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData || !userData.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: roleData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load original template
    const { data: originalTemplate, error: templateError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !originalTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create new template
    const newTemplateName = newName || `${originalTemplate.name} (Copy)`;
    const { data: newTemplate, error: createError } = await supabase
      .from('project_templates')
      .insert({
        name: newTemplateName,
        description: originalTemplate.description,
        created_by: userData.id,
        is_public: false, // Duplicates are private by default
        category: originalTemplate.category,
        version: originalTemplate.version || '1.0.0',
      })
      .select()
      .single();

    if (createError || !newTemplate) {
      console.error('Error creating duplicate template:', createError);
      return NextResponse.json(
        { error: `Failed to create duplicate template: ${createError?.message}` },
        { status: 500 }
      );
    }

    // Load original template phases
    const { data: originalPhases, error: phasesError } = await supabase
      .from('template_phases')
      .select('*')
      .eq('template_id', templateId);

    if (phasesError) {
      console.error('Error loading template phases:', phasesError);
      return NextResponse.json(
        { error: `Failed to load template phases: ${phasesError.message}` },
        { status: 500 }
      );
    }

    // Duplicate template phases
    if (originalPhases && originalPhases.length > 0) {
      const newPhases = originalPhases.map(phase => ({
        template_id: newTemplate.id,
        phase_number: phase.phase_number,
        data: phase.data,
      }));

      const { error: insertPhasesError } = await supabase
        .from('template_phases')
        .insert(newPhases);

      if (insertPhasesError) {
        console.error('Error duplicating template phases:', insertPhasesError);
        // Continue anyway - phases are optional
      }
    }

    // Load original field configs
    const { data: originalFieldConfigs, error: configsError } = await supabase
      .from('template_field_configs')
      .select('*')
      .eq('template_id', templateId);

    if (configsError) {
      console.error('Error loading field configs:', configsError);
      return NextResponse.json(
        { error: `Failed to load field configs: ${configsError.message}` },
        { status: 500 }
      );
    }

    // Duplicate field configs
    if (originalFieldConfigs && originalFieldConfigs.length > 0) {
      const newFieldConfigs = originalFieldConfigs.map(config => {
        // Explicitly exclude the original id and let the database generate a new one
        const { id, created_at, ...configWithoutId } = config;
        return {
          template_id: newTemplate.id,
          phase_number: config.phase_number,
          field_key: config.field_key,
          field_type: config.field_type,
          display_order: config.display_order,
          layout_config: config.layout_config || {},
          field_config: config.field_config || {},
          conditional_logic: config.conditional_logic || null,
          group_id: config.group_id || null,
        };
      });

      const { error: insertConfigsError } = await supabase
        .from('template_field_configs')
        .insert(newFieldConfigs);

      if (insertConfigsError) {
        console.error('Error duplicating field configs:', insertConfigsError);
        return NextResponse.json(
          { error: `Failed to duplicate field configs: ${insertConfigsError.message}` },
          { status: 500 }
        );
      }
    }

    // Load original field groups
    const { data: originalGroups, error: groupsError } = await supabase
      .from('template_field_groups')
      .select('*')
      .eq('template_id', templateId);

    if (groupsError) {
      console.error('Error loading field groups:', groupsError);
      // Continue anyway - groups are optional
    }

    // Duplicate field groups
    if (originalGroups && originalGroups.length > 0) {
      const newGroups = originalGroups.map(group => {
        // Explicitly exclude the original id and let the database generate a new one
        const { id, created_at, ...groupWithoutId } = group;
        return {
          template_id: newTemplate.id,
          phase_number: group.phase_number,
          group_key: group.group_key,
          label: group.label,
          description: group.description || null,
          icon: group.icon || null,
          collapsible: group.collapsible !== undefined ? group.collapsible : true,
          default_collapsed: group.default_collapsed !== undefined ? group.default_collapsed : false,
          display_order: group.display_order,
        };
      });

      const { error: insertGroupsError } = await supabase
        .from('template_field_groups')
        .insert(newGroups);

      if (insertGroupsError) {
        console.error('Error duplicating field groups:', insertGroupsError);
        // Continue anyway - groups are optional
      }
    }

    return NextResponse.json({
      success: true,
      template: newTemplate,
      message: 'Template duplicated successfully',
    });
  } catch (error) {
    console.error('Error duplicating template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

