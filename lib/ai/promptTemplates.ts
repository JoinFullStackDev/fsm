/**
 * Common prompt templates and constants for AI operations
 * Reduces duplication and improves maintainability
 */

/**
 * Common assignment rules for SOW member task assignment
 * Used in both task generation and project analysis
 */
export const SOW_ASSIGNMENT_RULES = `CRITICAL ASSIGNMENT RULES - MATCH IN THIS EXACT ORDER:

STEP 1: PHASE MATCHING (MANDATORY - Must match first):
   Check the task's phase_number and look up the corresponding phase name from the "Project Phases" list above.
   Then analyze what type of work that phase requires and match it to team members:
   
   - Find the phase name for the task's phase_number (e.g., if phase_number is 6, find "Phase 6: [phase name]")
   - Analyze the phase name to understand what work it requires:
     * If phase name contains "concept", "discovery", "strategy", "planning", "framing", "research", "requirements": Match to roles with "product", "strategy", "business", "analyst", "owner", "manager" in role_name or role_description
     * If phase name contains "design", "UI", "UX", "wireframe", "mockup", "visual": Match to roles with "design", "UI", "UX", "visual", "creative" in role_name or role_description
     * If phase name contains "build", "develop", "implement", "code", "engineering", "accelerator", "technical", "architecture", "API", "backend", "frontend", "database": Match to roles with "engineer", "developer", "architect", "technical", "programmer", "coder", "backend", "frontend", "full-stack", "software" in role_name or role_description
     * If phase name contains "QA", "quality", "test", "testing", "hardening", "verification", "assurance", "analysis" (in testing context): Match to roles with "QA", "test", "quality", "assurance", "tester", "SDET" in role_name or role_description
     * If phase name contains "analysis", "user stories", "stories", "specification": Match to roles with "product", "analyst", "manager", "owner", "technical" in role_name or role_description
   
   IMPORTANT EXAMPLES:
   - Phase name "Testing & Quality Assurance" → Match to roles containing "QA", "test", "quality", "assurance", "tester", "SDET"
   - Phase name "Build Accelerator" → Match to roles containing "engineer", "developer", "architect", "technical", "programmer"
   - Phase name "Product Strategy" → Match to roles containing "product", "strategy", "manager", "owner", "business"
   
   CRITICAL: Use semantic matching - if a phase is about "Testing & Quality Assurance" and someone's role_name is "QA Engineer" or role_description mentions "quality assurance", that's a match.
   - Compare the phase name directly to each team member's role_name and role_description
   - Use the EXACT role_name and role_description from the team members list above
   - If the role_name or role_description semantically matches what the phase requires, it's a match
   - If NO team member's role matches the phase requirements, set assignee_id to null (DO NOT assign)

STEP 2: TITLE MATCHING (Required if phase matches):
   After filtering by phase, check the task title for keywords. Match against the team member's ACTUAL role_name and role_description:
   
   - Title contains "design", "UI", "UX", "wireframe", "mockup", "visual", "designer": Role_name or role_description MUST contain "design", "UI", "UX", "visual", "creative", or similar design-related terms
   - Title contains "code", "implement", "develop", "build", "API", "backend", "frontend", "database", "engineer", "developer": Role_name or role_description MUST contain "engineer", "developer", "architect", "technical", "programmer", "coder", "backend", "frontend", or similar technical terms
   - Title contains "test", "QA", "quality", "testing", "verify", "test case": Role_name or role_description MUST contain "QA", "test", "quality", "assurance", "tester", or similar testing-related terms
   - Title contains "product", "strategy", "requirements", "stakeholder", "roadmap", "product manager": Role_name or role_description MUST contain "product", "strategy", "manager", "owner", "analyst", "business", or similar product/business terms
   - Title contains "business", "sales", "marketing", "outreach", "partnership": Role_name or role_description MUST contain "business", "sales", "marketing", "development", "partnership", or similar business-related terms
   
   IMPORTANT: Match against the ACTUAL role_name and role_description from the team members list, not generic role names.
   If title keywords don't match the role name/description, set assignee_id to null (DO NOT assign).

STEP 3: DESCRIPTION MATCHING (Required if phase and title match):
   Check the task description for keywords that confirm the role match. Use the team member's ACTUAL role_name and role_description:
   
   - Description mentions coding, APIs, databases, infrastructure, technical: Role_name or role_description MUST contain technical/engineering keywords
   - Description mentions design, wireframes, mockups, visual, user experience: Role_name or role_description MUST contain design-related keywords
   - Description mentions testing, test cases, quality assurance, verification: Role_name or role_description MUST contain testing/QA keywords
   - Description mentions product strategy, requirements gathering, stakeholder management: Role_name or role_description MUST contain product/business/strategy keywords
   - Description mentions sales, partnerships, business relationships: Role_name or role_description MUST contain business/sales keywords
   
   IMPORTANT: Use semantic matching - if the description aligns with what the role_name or role_description indicates the person does, it's a match.
   If description doesn't confirm the role match, set assignee_id to null (DO NOT assign).

STEP 4: FINAL VALIDATION:
   - ALL THREE criteria (phase, title, description) MUST match the role based on the ACTUAL role_name and role_description
   - Use semantic understanding: if a role description says "responsible for frontend development", that person should get frontend tasks
   - If any criterion doesn't match, set assignee_id to null
   - Among multiple matching members, prefer those with fewer current tasks
   - Avoid overworked members (marked [OVERWORKED]) unless they're the only match
   - If no clear match exists after all checks, set assignee_id to null

CRITICAL: Use the exact user_id UUID for assignee_id, NOT the name. 
ONLY assign if ALL THREE criteria (phase, title, description) clearly match the role based on the ACTUAL role_name and role_description provided above. 
When in doubt, leave unassigned (null).`;

/**
 * Build SOW members context string for prompts
 */
export function buildSOWMembersContext(
  sowMembers: Array<{
    user_id: string;
    name: string;
    role_name: string;
    role_description: string | null;
    current_task_count: number;
    is_overworked: boolean;
  }>,
  phases: Array<{ phase_number: number; phase_name?: string }>
): string {
  if (!sowMembers || sowMembers.length === 0) {
    return '';
  }

  const membersList = sowMembers
    .map(
      (m) =>
        `- ${m.name} (ID: ${m.user_id}, Role: "${m.role_name}"${
          m.role_description ? ` - Description: "${m.role_description}"` : ''
        }): ${m.current_task_count} current tasks${
          m.is_overworked ? ' [OVERWORKED - avoid assigning]' : ''
        }`
    )
    .join('\n');

  const phasesList = phases
    .map((p) => `- Phase ${p.phase_number}: "${p.phase_name || `Phase ${p.phase_number}`}"`)
    .join('\n');

  return `\n\nTeam Members Available (from Scope of Work):
${membersList}

Project Phases (for reference):
${phasesList}

${SOW_ASSIGNMENT_RULES}`;
}

