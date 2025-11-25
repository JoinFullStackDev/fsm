/**
 * Phase dependency utilities
 * Ensures phases are completed in order (Phase 1 -> Phase 2 -> ... -> Phase 6)
 */

export interface PhaseStatus {
  phase_number: number;
  completed: boolean;
}

/**
 * Check if a phase can be completed based on previous phases
 * @param phaseNumber - The phase number to check (1-6)
 * @param phaseStatuses - Array of all phase statuses for the project
 * @returns Object with canComplete boolean and missingPhases array
 */
export function canCompletePhase(
  phaseNumber: number,
  phaseStatuses: PhaseStatus[]
): { canComplete: boolean; missingPhases: number[] } {
  if (phaseNumber === 1) {
    // Phase 1 can always be completed (no dependencies)
    return { canComplete: true, missingPhases: [] };
  }

  // Check if all previous phases are completed
  const missingPhases: number[] = [];
  
  for (let i = 1; i < phaseNumber; i++) {
    const previousPhase = phaseStatuses.find(p => p.phase_number === i);
    if (!previousPhase || !previousPhase.completed) {
      missingPhases.push(i);
    }
  }

  return {
    canComplete: missingPhases.length === 0,
    missingPhases,
  };
}

/**
 * Get a user-friendly message about phase dependencies
 * @param phaseNumber - The current phase number
 * @param missingPhases - Array of phase numbers that need to be completed
 * @param phaseNamesMap - Optional map of phase numbers to phase names (from database)
 */
export function getPhaseDependencyMessage(
  phaseNumber: number,
  missingPhases: number[],
  phaseNamesMap?: Record<number, string>
): string {
  if (missingPhases.length === 0) {
    return '';
  }

  // Use provided phase names map, or fallback to default names
  const defaultPhaseNames: Record<number, string> = {
    1: 'Concept Framing',
    2: 'Product Strategy',
    3: 'Rapid Prototype Definition',
    4: 'Analysis & User Stories',
    5: 'Build Accelerator',
    6: 'QA & Hardening',
  };

  const phaseNames = phaseNamesMap || defaultPhaseNames;

  // Get phase name with fallback
  const getPhaseName = (num: number): string => {
    return phaseNames[num] || `Phase ${num}`;
  };

  if (missingPhases.length === 1) {
    return `Please complete ${getPhaseName(missingPhases[0])} (Phase ${missingPhases[0]}) before completing this phase.`;
  }

  const missingNames = missingPhases
    .map(num => `${getPhaseName(num)} (Phase ${num})`)
    .join(', ');
  
  return `Please complete the following phases before completing this phase: ${missingNames}`;
}

/**
 * Check if a phase can be edited (viewing is always allowed)
 * Editing is allowed even if previous phases aren't completed,
 * but completion is restricted
 */
export function canEditPhase(phaseNumber: number, phaseStatuses: PhaseStatus[]): boolean {
  // All phases can be edited regardless of dependencies
  // Only completion is restricted
  return true;
}

