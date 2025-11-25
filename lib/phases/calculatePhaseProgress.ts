import type {
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data,
  Phase6Data,
} from '@/types/phases';

type PhaseData = Phase1Data | Phase2Data | Phase3Data | Phase4Data | Phase5Data | Phase6Data;

/**
 * Calculate the completion percentage of a phase based on field values
 */
export function calculatePhaseProgress(phaseNumber: number, phaseData: PhaseData | null): number {
  if (!phaseData) return 0;

  let totalFields = 0;
  let completedFields = 0;

  const checkValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) {
      if (value.length === 0) return false;
      // For arrays of objects, check if at least one object has meaningful content
      if (value.length > 0 && typeof value[0] === 'object') {
        return value.some(item => {
          if (typeof item === 'object' && item !== null) {
            return Object.keys(item).some(key => checkValue(item[key]));
          }
          return checkValue(item);
        });
      }
      return true;
    }
    if (typeof value === 'object') {
      // Check if object has any non-empty values
      const keys = Object.keys(value);
      if (keys.length === 0) return false;
      // For nested objects, check if they have meaningful content
      return keys.some(key => checkValue(value[key]));
    }
    return true;
  };

  switch (phaseNumber) {
    case 1: {
      const data = phaseData as Phase1Data;
      const fields = [
        'problem_statement',
        'target_users',
        'why_now',
        'value_hypothesis',
        'constraints',
        'risks',
        'assumptions',
        'initial_features',
        'feasibility_notes',
        'high_level_timeline',
      ];
      totalFields = fields.length;
      completedFields = fields.filter(field => checkValue(data[field as keyof Phase1Data])).length;
      break;
    }
    case 2: {
      const data = phaseData as Phase2Data;
      const fields = [
        'personas',
        'jtbd',
        'business_outcomes',
        'kpis',
        'features',
        'scored_features',
        'tech_stack_preferences',
      ];
      totalFields = fields.length;
      completedFields = fields.filter(field => checkValue(data[field as keyof Phase2Data])).length;
      break;
    }
    case 3: {
      const data = phaseData as Phase3Data;
      const fields = [
        'screens',
        'flows',
        'components',
        'design_tokens',
        'navigation',
      ];
      totalFields = fields.length;
      completedFields = fields.filter(field => checkValue(data[field as keyof Phase3Data])).length;
      break;
    }
    case 4: {
      const data = phaseData as Phase4Data;
      const fields = [
        'entities',
        'erd',
        'api_spec',
        'user_stories',
        'acceptance_criteria',
        'rbac',
        'non_functional_requirements',
      ];
      totalFields = fields.length;
      completedFields = fields.filter(field => checkValue(data[field as keyof Phase4Data])).length;
      break;
    }
    case 5: {
      const data = phaseData as Phase5Data;
      const fields = [
        'folder_structure',
        'architecture_instructions',
        'coding_standards',
        'env_setup',
      ];
      totalFields = fields.length;
      completedFields = fields.filter(field => checkValue(data[field as keyof Phase5Data])).length;
      break;
    }
    case 6: {
      const data = phaseData as Phase6Data;
      const fields = [
        'test_plan',
        'test_cases',
        'security_checklist',
        'performance_requirements',
        'launch_readiness',
      ];
      totalFields = fields.length;
      completedFields = fields.filter(field => checkValue(data[field as keyof Phase6Data])).length;
      break;
    }
    default:
      return 0;
  }

  return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
}

