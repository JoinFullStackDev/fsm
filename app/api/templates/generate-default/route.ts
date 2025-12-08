import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getDefaultFieldConfigsForPhase, PHASE_FIELD_DEFINITIONS } from '@/lib/templates/createDefaultTemplate';
import { getDefaultPhaseData } from '@/lib/phaseSchemas';
import type { TemplateFieldConfig } from '@/types/templates';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
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

    // Allow admins and PMs to generate default templates
    if (userError || !userData || (userData.role !== 'admin' && userData.role !== 'pm')) {
      return NextResponse.json({ error: 'Forbidden - Admin or PM access required' }, { status: 403 });
    }

    // Check if default template already exists
    const { data: existingTemplate } = await supabase
      .from('project_templates')
      .select('id')
      .eq('name', 'FullStack Method Default')
      .single();

    if (existingTemplate) {
      return NextResponse.json({
        message: 'Default template already exists',
        template_id: existingTemplate.id,
      });
    }

    // Get user ID for created_by
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create default template
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .insert({
        name: 'FullStack Method Default',
        description: 'Default template based on the current FullStack Method phase structure. This template includes all standard fields for all 6 phases.',
        created_by: dbUser.id,
        is_public: true,
        category: 'default',
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

    // Create template phases with default data
    const phaseInserts = [];
    for (let i = 1; i <= 6; i++) {
      phaseInserts.push({
        template_id: template.id,
        phase_number: i,
        data: getDefaultPhaseData(i),
      });
    }

    const { error: phasesError } = await supabase
      .from('template_phases')
      .insert(phaseInserts);

    if (phasesError) {
      // Clean up template if phases fail
      await supabase.from('project_templates').delete().eq('id', template.id);
      return NextResponse.json(
        { error: `Failed to create template phases: ${phasesError.message}` },
        { status: 500 }
      );
    }

    // Create field configs for all phases
    const allFieldConfigs: Array<Omit<TemplateFieldConfig, 'id'> & { template_id: string }> = [];
    for (let i = 1; i <= 6; i++) {
      const fieldConfigs = PHASE_FIELD_DEFINITIONS[i] || [];
      fieldConfigs.forEach(config => {
        allFieldConfigs.push({
          ...config,
          template_id: template.id,
        });
      });
    }

    if (allFieldConfigs.length > 0) {
      const { error: configsError } = await supabase
        .from('template_field_configs')
        .insert(allFieldConfigs);

      if (configsError) {
        // Don't fail the request, but log the error
        // Field configs can be added later via the builder
      }
    }

    return NextResponse.json({
      message: 'Default template created successfully',
      template_id: template.id,
      field_configs_count: allFieldConfigs.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

