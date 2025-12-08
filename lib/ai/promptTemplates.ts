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
 * Compact assignment rules - much more effective and 90% smaller than original
 */
export const COMPACT_ASSIGNMENT_RULES = `TASK ASSIGNMENT RULES:

1. MATCH ROLE TO TASK: Check if team member's role_name/role_description contains keywords matching the task:
   - Engineer/Developer roles → code, API, database, implement, build, integrate tasks
   - Designer roles → design, wireframe, mockup, UI, UX, prototype tasks  
   - QA/Tester roles → test, verify, validate, quality, bug tasks
   - Product/Manager roles → requirements, strategy, roadmap, stakeholder tasks
   - Business/Sales roles → business, sales, marketing, partnership tasks

2. MATCH ROLE TO PHASE: The task's phase should align with the role's work type:
   - Early phases (concept, strategy, planning) → Product/Manager roles
   - Design phases → Designer roles
   - Build/Development phases → Engineer/Developer roles
   - Testing/QA phases → QA/Tester roles

3. ASSIGNMENT PRIORITY:
   - Prefer members with fewer current tasks (load balancing)
   - Avoid members marked [BUSY] unless they're the only match
   - If no clear match, set assignee_id to null

4. CRITICAL: Use exact user_id UUID, NOT the name. When uncertain, leave unassigned (null).`;

/**
 * Legacy assignment rules - kept for backwards compatibility
 * @deprecated Use COMPACT_ASSIGNMENT_RULES instead
 */
export const SOW_ASSIGNMENT_RULES = COMPACT_ASSIGNMENT_RULES;

/**
 * Build compact SOW members context for prompts
 * Optimized for minimal token usage while preserving assignment effectiveness
 */
export function buildCompactSOWContext(
  sowMembers: SOWMember[],
  phases?: PhaseInfo[]
): string {
  if (!sowMembers?.length) return '';

  // Compact member format: id|role|description|tasks|status
  const membersList = sowMembers
    .map(m => {
      const status = m.is_overworked ? ' [BUSY]' : '';
      const desc = m.role_description ? ` (${m.role_description.substring(0, 50)})` : '';
      return `- ${m.user_id} | ${m.role_name}${desc} | ${m.current_task_count} tasks${status}`;
    })
    .join('\n');

  // Optional phase list for context
  const phaseContext = phases?.length
    ? `\nPhases: ${phases.map(p => `${p.phase_number}:${p.phase_name || 'Phase ' + p.phase_number}`).join(', ')}`
    : '';

  return `
TEAM MEMBERS (id | role | tasks):
${membersList}${phaseContext}

${COMPACT_ASSIGNMENT_RULES}`;
}

/**
 * Build SOW members context string for prompts
 * @deprecated Use buildCompactSOWContext for better token efficiency
 */
export function buildSOWMembersContext(
  sowMembers: SOWMember[],
  phases: PhaseInfo[]
): string {
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
