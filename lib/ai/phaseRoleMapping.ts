/**
 * Phase role mapping utility
 * Computes which roles match which phases based on phase names
 * Cached for performance
 */

export interface PhaseRoleMapping {
  phase_number: number;
  phase_name: string;
  matching_roles: string[];
}

// In-memory cache for phase role mappings
const mappingCache = new Map<string, PhaseRoleMapping[]>();

/**
 * Generate cache key for phase role mapping
 */
function getCacheKey(phases: Array<{ phase_number: number; phase_name?: string }>): string {
  return phases
    .map((p) => `${p.phase_number}:${p.phase_name || ''}`)
    .join('|');
}

/**
 * Compute phase role mapping based on phase names
 * Results are cached for performance
 */
export function computePhaseRoleMapping(
  phases: Array<{ phase_number: number; phase_name?: string }>
): PhaseRoleMapping[] {
  const cacheKey = getCacheKey(phases);
  
  // Check cache first
  const cached = mappingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Compute mapping
  const mapping = phases.map((p) => {
    const phaseName = (p.phase_name || `Phase ${p.phase_number}`).toLowerCase();
    const phaseNum = p.phase_number;

    // Determine which roles match this phase based on phase name keywords
    const matchingRoles: string[] = [];

    // Strategy/Discovery/Concept phases
    if (
      phaseName.match(
        /(concept|discovery|strategy|planning|framing|research|analysis|requirements)/i
      )
    ) {
      matchingRoles.push(
        'Product Manager',
        'Product Owner',
        'Business Analyst',
        'Strategist',
        'Business Development'
      );
    }

    // Design phases
    if (phaseName.match(/(design|ui|ux|wireframe|mockup|visual|prototype|rapid prototype)/i)) {
      matchingRoles.push('Designer', 'UI/UX Designer', 'Product Manager', 'Product Owner');
    }

    // Engineering/Build phases
    if (
      phaseName.match(
        /(build|develop|implement|code|engineering|accelerator|prototype|rapid prototype|technical|architecture|api|backend|frontend|database)/i
      )
    ) {
      matchingRoles.push(
        'Engineer',
        'Developer',
        'Architect',
        'Technical Lead',
        'Frontend Engineer',
        'Backend Engineer',
        'Full-Stack Engineer',
        'Software Engineer'
      );
    }

    // QA/Testing phases
    if (
      phaseName.match(
        /(qa|quality|test|testing|hardening|verification|assurance|analysis)/i
      )
    ) {
      matchingRoles.push(
        'QA Engineer',
        'Tester',
        'QA Analyst',
        'Quality Assurance',
        'Test Engineer',
        'SDET'
      );
    }

    // Analysis/User Stories phases
    if (
      phaseName.match(
        /(analysis|user stories|stories|specification|requirements gathering)/i
      )
    ) {
      matchingRoles.push(
        'Engineer',
        'Developer',
        'Product Manager',
        'Product Owner',
        'Technical Lead'
      );
    }

    return {
      phase_number: phaseNum,
      phase_name: p.phase_name || `Phase ${phaseNum}`,
      matching_roles: [...new Set(matchingRoles)], // Remove duplicates
    };
  });

  // Cache the result
  mappingCache.set(cacheKey, mapping);

  return mapping;
}

/**
 * Clear the mapping cache (useful for testing or when phases change significantly)
 */
export function clearPhaseRoleMappingCache(): void {
  mappingCache.clear();
}

