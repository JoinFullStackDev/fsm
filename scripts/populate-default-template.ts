/**
 * Script to populate the default template with all field configurations
 * This can be run manually or called from the API endpoint
 * 
 * Usage: npx tsx scripts/populate-default-template.ts
 * Or call the API endpoint: POST /api/admin/templates/generate-default
 */

import { createClient } from '@supabase/supabase-js';
import { PHASE_FIELD_DEFINITIONS } from '../lib/templates/createDefaultTemplate';
import { getDefaultPhaseData } from '../lib/phaseSchemas';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function populateDefaultTemplate() {
  try {
    console.log('Starting default template population...');

    // Get first admin user
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (adminError) {
      console.error('Error finding admin user:', adminError);
      return;
    }

    const adminUserId = adminUsers?.[0]?.id || null;

    // Check if default template exists
    const { data: existingTemplate } = await supabase
      .from('project_templates')
      .select('id')
      .eq('name', 'FullStack Method Default')
      .single();

    let templateId: string;

    if (existingTemplate) {
      console.log('Default template already exists, using existing ID:', existingTemplate.id);
      templateId = existingTemplate.id;
      
      // Delete existing field configs to regenerate
      await supabase
        .from('template_field_configs')
        .delete()
        .eq('template_id', templateId);
    } else {
      // Create default template
      const { data: template, error: templateError } = await supabase
        .from('project_templates')
        .insert({
          name: 'FullStack Method Default',
          description: 'Default template based on the current FullStack Method phase structure. This template includes all standard fields for all 6 phases with their current configurations.',
          created_by: adminUserId,
          is_public: true,
          category: 'default',
          version: '1.0.0',
        })
        .select()
        .single();

      if (templateError || !template) {
        throw new Error(`Failed to create template: ${templateError?.message}`);
      }

      templateId = template.id;
      console.log('Created default template with ID:', templateId);

      // Create template phases with default data
      const phaseInserts = [];
      for (let i = 1; i <= 6; i++) {
        phaseInserts.push({
          template_id: templateId,
          phase_number: i,
          data: getDefaultPhaseData(i),
        });
      }

      const { error: phasesError } = await supabase
        .from('template_phases')
        .insert(phaseInserts);

      if (phasesError) {
        throw new Error(`Failed to create template phases: ${phasesError.message}`);
      }
      console.log('Created template phases');
    }

    // Insert all field configs
    const allFieldConfigs: any[] = [];
    for (let phase = 1; phase <= 6; phase++) {
      const fieldConfigs = PHASE_FIELD_DEFINITIONS[phase] || [];
      fieldConfigs.forEach(config => {
        allFieldConfigs.push({
          ...config,
          template_id: templateId,
        });
      });
    }

    if (allFieldConfigs.length > 0) {
      const { error: configsError } = await supabase
        .from('template_field_configs')
        .insert(allFieldConfigs);

      if (configsError) {
        throw new Error(`Failed to insert field configs: ${configsError.message}`);
      }
      console.log(`Inserted ${allFieldConfigs.length} field configurations`);
    }

    console.log('✅ Default template populated successfully!');
    console.log(`Template ID: ${templateId}`);
    console.log(`Total fields: ${allFieldConfigs.length}`);
  } catch (error) {
    console.error('Error populating default template:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populateDefaultTemplate();
}

export { populateDefaultTemplate };

