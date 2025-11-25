import type { SupabaseClient } from '@supabase/supabase-js';
import type { TemplatePhase } from '@/types/project';

const DEFAULT_PHASE_NAMES: Record<number, string> = {
  1: 'Concept Framing',
  2: 'Product Strategy',
  3: 'Rapid Prototype Definition',
  4: 'Analysis & User Stories',
  5: 'Build Accelerator',
  6: 'QA & Hardening',
};

/**
 * Ensures that phases exist for a template by checking field configs
 * and creating phase records if they don't exist.
 * This provides backward compatibility for templates created before
 * the dynamic phase system was implemented.
 */
export async function ensurePhasesExist(
  templateId: string,
  supabase: SupabaseClient
): Promise<TemplatePhase[]> {
  // Check if phases already exist
  const { data: existingPhases, error: phasesError } = await supabase
    .from('template_phases')
    .select('*')
    .eq('template_id', templateId)
    .eq('is_active', true);

  if (phasesError) {
    console.error('[ensurePhasesExist] Error checking existing phases:', phasesError);
    return [];
  }

  // If phases exist, return them
  if (existingPhases && existingPhases.length > 0) {
    return existingPhases as TemplatePhase[];
  }

  // No phases exist - check field configs for phase numbers
  const { data: fieldConfigs, error: configsError } = await supabase
    .from('template_field_configs')
    .select('phase_number')
    .eq('template_id', templateId);

  if (configsError) {
    console.error('[ensurePhasesExist] Error checking field configs:', configsError);
    return [];
  }

  // Get unique phase numbers from field configs
  const uniquePhaseNumbers = new Set<number>();
  fieldConfigs?.forEach((config) => {
    if (config.phase_number) {
      uniquePhaseNumbers.add(config.phase_number);
    }
  });

  // If no field configs found, return empty array (template has no phases yet)
  if (uniquePhaseNumbers.size === 0) {
    return [];
  }

  // Create phase records for each unique phase number
  const phasesToCreate = Array.from(uniquePhaseNumbers)
    .sort((a, b) => a - b)
    .map((phaseNumber) => ({
      template_id: templateId,
      phase_number: phaseNumber,
      phase_name: DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`,
      display_order: phaseNumber,
      is_active: true,
      data: {},
    }));

  // Insert phases
  const { data: createdPhases, error: insertError } = await supabase
    .from('template_phases')
    .insert(phasesToCreate)
    .select();

  if (insertError) {
    console.error('[ensurePhasesExist] Error creating phases:', insertError);
    return [];
  }

  console.log(`[ensurePhasesExist] Created ${createdPhases?.length || 0} phases for template ${templateId}`);
  return (createdPhases || []) as TemplatePhase[];
}

