/**
 * Common prompt templates and constants for AI operations
 * Optimized for reduced token usage while maintaining effectiveness
 */

/**
 * SOW Member type for task assignment
 */
export interface SOWMember {
  user_id: string;
  name: string;
  role_name: string;
  role_description: string | null;
  current_task_count: number;
  is_overworked: boolean;
}

/**
 * Phase info for context building
 */
export interface PhaseInfo {
  phase_number: number;
  phase_name?: string;
}

/**
 * Result from buildCompactSOWContext with short ID mapping
 */
export interface SOWContextResult {
  promptText: string;
  shortIdMap: Map<string, string>; // shortId (M1, M2) -> full UUID
}

/**
 * Role keyword mappings for task assignment
 * Maps role types to task keywords they should handle
 */
export const ROLE_KEYWORD_MAP: Record<string, string[]> = {
  // Engineering/Development roles
  'engineer|developer|technical|architect|programmer|coder|backend|frontend|full-stack|software': [
    'code', 'implement', 'develop', 'build', 'API', 'database', 'backend', 'frontend',
    'integrate', 'debug', 'deploy', 'infrastructure', 'architecture', 'technical'
  ],
  // Design roles
  'design|UI|UX|visual|creative|graphic': [
    'design', 'wireframe', 'mockup', 'prototype', 'UI', 'UX', 'visual', 'layout',
    'interface', 'user experience', 'style guide', 'figma', 'sketch'
  ],
  // QA/Testing roles
  'QA|test|quality|assurance|tester|SDET': [
    'test', 'QA', 'verify', 'validate', 'quality', 'bug', 'regression',
    'test case', 'automation', 'testing', 'coverage'
  ],
  // Product/Strategy roles
  'product|strategy|manager|owner|analyst|business analyst|PM': [
    'requirements', 'strategy', 'roadmap', 'stakeholder', 'user stories',
    'prioritize', 'scope', 'specification', 'planning', 'analysis'
  ],
  // Business/Sales roles
  'business|sales|marketing|growth|partnership': [
    'business', 'sales', 'marketing', 'outreach', 'partnership',
    'customer', 'lead', 'revenue', 'growth'
  ]
};

/**
 * Phase type mappings - which role types typically work on which phase types
 */
export const PHASE_ROLE_MAP: Record<string, string[]> = {
  'concept|discovery|strategy|planning|framing|research': ['product', 'strategy', 'manager', 'analyst', 'business'],
  'design|UI|UX|wireframe|mockup|visual': ['design', 'UI', 'UX', 'visual', 'creative'],
  'build|develop|implement|code|engineering|accelerator|technical|architecture': ['engineer', 'developer', 'architect', 'technical', 'programmer'],
  'QA|quality|test|testing|hardening|verification|assurance': ['QA', 'test', 'quality', 'assurance', 'tester'],
  'analysis|user stories|stories|specification': ['product', 'analyst', 'manager', 'owner']
};

/**
 * Compact assignment rules - optimized for short IDs (M1, M2, etc.)
 */
export const COMPACT_ASSIGNMENT_RULES = `TASK ASSIGNMENT:

Use short IDs (M1, M2, M3...) for assignee_id, NOT names or UUIDs.

ROLE MATCHING:
- Developer/Engineer → "Build API", "Implement feature", "Fix bug", "Database migration"
- Designer → "Create mockups", "Design UI", "Wireframe screens", "Style guide"
- QA/Tester → "Write tests", "Verify feature", "Test regression", "Bug testing"
- Product/Manager → "Define requirements", "Write user stories", "Plan sprint"
- Business/Sales → "Customer outreach", "Sales demo", "Marketing campaign"

EXAMPLES:
- "Build user authentication API" → assign to Developer (M1 if Developer)
- "Create dashboard mockups" → assign to Designer
- "Write unit tests for login" → assign to QA/Tester
- "Define MVP requirements" → assign to Product Manager

PRIORITY:
1. Match role keywords to task content
2. Prefer members with fewer tasks (see task count)
3. Skip [BUSY] members unless only option
4. If unclear, set assignee_id to null`;

/**
 * Legacy assignment rules - kept for backwards compatibility
 * @deprecated Use COMPACT_ASSIGNMENT_RULES instead
 */
export const SOW_ASSIGNMENT_RULES = COMPACT_ASSIGNMENT_RULES;

/**
 * Build compact SOW members context for prompts
 * Uses short IDs (M1, M2, M3) instead of full UUIDs for easier AI processing
 * Returns both the prompt text and a mapping to expand short IDs back to UUIDs
 */
export function buildCompactSOWContext(
  sowMembers: SOWMember[],
  phases?: PhaseInfo[]
): SOWContextResult {
  if (!sowMembers?.length) {
    return { promptText: '', shortIdMap: new Map() };
  }

  // Create short ID mapping for easier AI processing
  const shortIdMap = new Map<string, string>();
  
  // Compact member format: shortId|role|description|tasks|status
  const membersList = sowMembers
    .map((m, index) => {
      const shortId = `M${index + 1}`; // M1, M2, M3... much easier for AI
      shortIdMap.set(shortId, m.user_id);
      
      const status = m.is_overworked ? ' [BUSY]' : '';
      const desc = m.role_description ? ` (${m.role_description.substring(0, 50)})` : '';
      return `- ${shortId}: ${m.role_name}${desc} | ${m.current_task_count} tasks${status}`;
    })
    .join('\n');

  // Optional phase list for context
  const phaseContext = phases?.length
    ? `\nPhases: ${phases.map(p => `${p.phase_number}:${p.phase_name || 'Phase ' + p.phase_number}`).join(', ')}`
    : '';

  const promptText = `
TEAM MEMBERS (use short ID for assignee_id):
${membersList}${phaseContext}

${COMPACT_ASSIGNMENT_RULES}`;

  return { promptText, shortIdMap };
}

/**
 * Build compact SOW context - legacy string version
 * @deprecated Use the SOWContextResult version and handle mapping separately
 */
export function buildCompactSOWContextString(
  sowMembers: SOWMember[],
  phases?: PhaseInfo[]
): string {
  const result = buildCompactSOWContext(sowMembers, phases);
  return result.promptText;
}

/**
 * Build SOW members context string for prompts
 * @deprecated Use buildCompactSOWContext for better token efficiency
 */
export function buildSOWMembersContext(
  sowMembers: SOWMember[],
  phases: PhaseInfo[]
): SOWContextResult {
  // Delegate to compact version for consistency
  return buildCompactSOWContext(sowMembers, phases);
}

/**
 * Get role keywords for matching
 */
export function getRoleKeywords(rolePattern: string): string[] {
  for (const [pattern, keywords] of Object.entries(ROLE_KEYWORD_MAP)) {
    if (new RegExp(pattern, 'i').test(rolePattern)) {
      return keywords;
    }
  }
  return [];
}

/**
 * Get expected role types for a phase name
 */
export function getPhaseRoleTypes(phaseName: string): string[] {
  for (const [pattern, roles] of Object.entries(PHASE_ROLE_MAP)) {
    if (new RegExp(pattern, 'i').test(phaseName)) {
      return roles;
    }
  }
  return [];
}

/**
 * Check if a role matches a phase type
 */
export function roleMatchesPhase(roleName: string, roleDescription: string | null, phaseName: string): boolean {
  const expectedRoles = getPhaseRoleTypes(phaseName);
  if (expectedRoles.length === 0) return true; // No specific requirement
  
  const roleText = `${roleName} ${roleDescription || ''}`.toLowerCase();
  return expectedRoles.some(role => roleText.includes(role.toLowerCase()));
}

/**
 * Check if a role matches task keywords
 */
export function roleMatchesTaskKeywords(
  roleName: string, 
  roleDescription: string | null, 
  taskTitle: string, 
  taskDescription: string | null
): boolean {
  const roleText = `${roleName} ${roleDescription || ''}`.toLowerCase();
  const taskText = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
  
  for (const [rolePattern, taskKeywords] of Object.entries(ROLE_KEYWORD_MAP)) {
    // Check if role matches this pattern
    if (new RegExp(rolePattern, 'i').test(roleText)) {
      // Check if task contains any of the expected keywords
      if (taskKeywords.some(keyword => taskText.includes(keyword.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find best assignee for a task based on role matching
 */
export function findBestAssignee(
  taskTitle: string,
  taskDescription: string | null,
  phaseName: string,
  sowMembers: SOWMember[]
): string | null {
  if (!sowMembers?.length) return null;

  // Score each member
  const scored = sowMembers.map(member => {
    let score = 0;
    
    // Phase match (most important)
    if (roleMatchesPhase(member.role_name, member.role_description, phaseName)) {
      score += 3;
    }
    
    // Task keyword match
    if (roleMatchesTaskKeywords(member.role_name, member.role_description, taskTitle, taskDescription)) {
      score += 2;
    }
    
    // Workload penalty
    score -= member.current_task_count * 0.1;
    
    // Overworked penalty
    if (member.is_overworked) {
      score -= 2;
    }
    
    return { member, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Only assign if score is positive (meaningful match)
  const best = scored[0];
  if (best && best.score > 0) {
    return best.member.user_id;
  }
  
  return null;
}
