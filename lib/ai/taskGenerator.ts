import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';
import type { PreviewTask } from '@/types/taskGenerator';

/**
 * Phase data structure for context
 */
export interface PhaseData {
  phase_number: number;
  phase_name?: string;
  display_order?: number;
  data: Record<string, unknown>;
  completed: boolean;
}

/**
 * Task generation result
 */
export interface TaskGenerationResult {
  tasks: PreviewTask[];
  summary?: string;
}

/**
 * Extract dates from text using AI
 * Handles specific dates, relative dates, and implied dates
 */
export async function extractDatesFromText(
  text: string,
  apiKey: string
): Promise<{ dueDate: string | null; extractedDates: string[] }> {
  const prompt = `Extract all dates and deadlines from the following text. Look for:
- Specific dates: "March 15th", "2025-02-12", "December 31, 2024"
- Relative dates: "in 2 weeks", "end of quarter", "next month"
- Implied dates: "before design review in June", "after the meeting next week"

Text: "${text}"

Return a JSON object with:
{
  "dates": ["2025-03-15", "2025-06-30", ...],  // Array of ISO date strings (YYYY-MM-DD)
  "earliest": "2025-03-15"  // The earliest date found, or null if none
}

If no dates are found, return: { "dates": [], "earliest": null }
If relative dates are found, calculate them from today's date: ${new Date().toISOString().split('T')[0]}`;

  try {
    const result = await generateStructuredAIResponse<{
      dates: string[];
      earliest: string | null;
    }>(prompt, {}, apiKey);

    // Handle both wrapped and unwrapped results
    const dateResult = 'result' in result ? result.result : result;

    return {
      dueDate: dateResult.earliest || null,
      extractedDates: dateResult.dates || [],
    };
  } catch (error) {
    logger.error('[Task Generator] Error extracting dates:', error);
    return { dueDate: null, extractedDates: [] };
  }
}

/**
 * SOW Member information for task assignment
 */
export interface SOWMember {
  user_id: string;
  name: string;
  role_name: string; // Custom organization role name (or fallback to project role)
  role_description: string | null; // Custom organization role description
  current_task_count: number;
  is_overworked: boolean;
}

/**
 * Generate tasks from user prompt/PRD
 */
export async function generateTasksFromPrompt(
  prompt: string,
  projectName: string,
  phases: PhaseData[],
  existingTasks: ProjectTask[],
  apiKey: string,
  context?: string,
  sowMembers?: SOWMember[]
): Promise<TaskGenerationResult> {
  // Build phase context
  const phaseList = phases
    .map((p) => `Phase ${p.phase_number}: ${p.phase_name || `Phase ${p.phase_number}`}${p.completed ? ' (Completed)' : ''}`)
    .join(', ');

  // Build existing tasks context for AI to avoid duplicates
  const existingTasksContext = existingTasks.length > 0
    ? `\n\nExisting tasks in this project (avoid creating exact duplicates):\n${existingTasks
        .slice(0, 20) // Limit to avoid token limits
        .map((t) => `- ${t.title}${t.description ? `: ${t.description.substring(0, 100)}` : ''}`)
        .join('\n')}`
    : '';

  // Build phase-to-role mapping based on actual phase names
  const phaseRoleMapping = phases.map(p => {
    const phaseName = (p.phase_name || `Phase ${p.phase_number}`).toLowerCase();
    const phaseNum = p.phase_number;
    
    // Determine which roles match this phase based on phase name keywords
    let matchingRoles: string[] = [];
    
    // Strategy/Discovery/Concept phases
    if (phaseName.match(/(concept|discovery|strategy|planning|framing|research|analysis|requirements)/i)) {
      matchingRoles.push('Product Manager', 'Product Owner', 'Business Analyst', 'Strategist', 'Business Development');
    }
    
    // Design phases
    if (phaseName.match(/(design|ui|ux|wireframe|mockup|visual|prototype|rapid prototype)/i)) {
      matchingRoles.push('Designer', 'UI/UX Designer', 'Product Manager', 'Product Owner');
    }
    
    // Engineering/Build phases
    if (phaseName.match(/(build|develop|implement|code|engineering|accelerator|prototype|rapid prototype|technical|architecture|api|backend|frontend|database)/i)) {
      matchingRoles.push('Engineer', 'Developer', 'Architect', 'Technical Lead', 'Frontend Engineer', 'Backend Engineer', 'Full-Stack Engineer');
    }
    
    // QA/Testing phases
    if (phaseName.match(/(qa|quality|test|testing|hardening|verification|assurance)/i)) {
      matchingRoles.push('QA Engineer', 'Tester', 'QA Analyst', 'Quality Assurance', 'Test Engineer');
    }
    
    // Analysis/User Stories phases
    if (phaseName.match(/(analysis|user stories|stories|specification|requirements gathering)/i)) {
      matchingRoles.push('Engineer', 'Developer', 'Product Manager', 'Product Owner', 'Technical Lead');
    }
    
    return {
      phase_number: phaseNum,
      phase_name: p.phase_name || `Phase ${phaseNum}`,
      matching_roles: [...new Set(matchingRoles)] // Remove duplicates
    };
  });

  // Build SOW members context for assignment
  const sowMembersContext = sowMembers && sowMembers.length > 0
    ? `\n\nTeam Members Available (from Scope of Work):
${sowMembers.map(m => 
  `- ${m.name} (ID: ${m.user_id}, Role: "${m.role_name}"${m.role_description ? ` - Description: "${m.role_description}"` : ''}): ${m.current_task_count} current tasks${m.is_overworked ? ' [OVERWORKED - avoid assigning]' : ''}`
).join('\n')}

Project Phases (for reference):
${phases.map(p => `- Phase ${p.phase_number}: "${p.phase_name || `Phase ${p.phase_number}`}"`).join('\n')}

CRITICAL ASSIGNMENT RULES - MATCH IN THIS EXACT ORDER:

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

CRITICAL: Use the exact user_id UUID (e.g., "${sowMembers[0]?.user_id}") for assignee_id, NOT the name. 
ONLY assign if ALL THREE criteria (phase, title, description) clearly match the role based on the ACTUAL role_name and role_description provided above. 
When in doubt, leave unassigned (null).`
    : '';

  const fullPrompt = `You are generating tasks for a project called "${projectName}" using The FullStack Method™ framework.

User Input/Prompt:
${prompt}
${context ? `\nAdditional Context:\n${context}` : ''}

Project Phases Available:
${phaseList}

${existingTasksContext}
${sowMembersContext}

Generate a comprehensive list of tasks based on the user's input. Each task should have:
- title: Clear, actionable task title
- description: Detailed description of what needs to be done
- phase_number: Which phase this task belongs to (must be one of: ${phases.map((p) => p.phase_number).join(', ')})
- priority: 'low', 'medium', 'high', or 'critical'
- status: 'todo' (for new tasks)
- estimated_hours: Estimated number of hours to complete this task (decimal number, e.g., 2.5, 8.0, 16.0). Consider task complexity, scope, and typical work patterns. If uncertain, provide a reasonable estimate.
- tags: Array of relevant tags
- requirements: Array of specific requirements for this task (extracted from the prompt)
- userStories: Array of user stories if mentioned in the prompt (optional)
- notes: Additional notes or context
${sowMembers && sowMembers.length > 0 ? '- assignee_id: user_id UUID of the team member to assign this task to (or null if no suitable member). Use the exact UUID from the team members list above, NOT the name.' : ''}

IMPORTANT: Extract dates from the user input. If dates are mentioned:
- Set due_date to the earliest date found
- If multiple dates are mentioned, use the earliest one
- If no dates are found, set due_date to null (user can set it later)
- Calculate relative dates from today: ${new Date().toISOString().split('T')[0]}

IMPORTANT: For estimated_hours:
- Provide realistic time estimates based on task complexity
- Simple tasks: 1-4 hours
- Medium tasks: 4-16 hours
- Complex tasks: 16-40 hours
- Very complex tasks: 40+ hours
- Consider the task description, requirements, and typical development patterns

Return your response as JSON in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "phase_number": 1,
      "priority": "high",
      "status": "todo",
      "estimated_hours": 8.0,
      "tags": ["tag1", "tag2"],
      "requirements": ["Requirement 1", "Requirement 2"],
      "userStories": ["As a user, I want..."],
      "notes": "Additional notes",
      "due_date": "2025-03-15" or null${sowMembers && sowMembers.length > 0 ? `,\n      "assignee_id": "${sowMembers[0]?.user_id}" or null (MUST be exact UUID from team members list above, NOT a name)` : ''}
    }
  ],
  "summary": "Brief summary of generated tasks"
}

Focus on actionable, specific tasks that directly address the user's prompt.`;

  try {
    const result = await generateStructuredAIResponse<{
      tasks: Array<{
        title: string;
        description: string;
        phase_number: number;
        priority: 'low' | 'medium' | 'high' | 'critical';
        status: 'todo';
        estimated_hours: number;
        tags: string[];
        requirements: string[];
        userStories?: string[];
        notes?: string;
        due_date: string | null;
        assignee_id?: string | null;
      }>;
      summary?: string;
    }>(fullPrompt, {
      projectData: {
        name: projectName,
        phases: phases.map((p) => ({
          phase_number: p.phase_number,
          phase_name: p.phase_name,
          completed: p.completed,
        })),
      },
    }, apiKey, projectName);

    // Handle both wrapped and unwrapped results
    const taskResult = 'result' in result ? result.result : result;

    // Convert to PreviewTask format
    const previewTasks: PreviewTask[] = taskResult.tasks.map((task, index) => {
      // Build notes JSONB structure
      const notesData: Record<string, any> = {
        requirements: task.requirements || [],
      };
      if (task.userStories && task.userStories.length > 0) {
        notesData.userStories = task.userStories;
      }
      if (task.notes) {
        notesData.notes = task.notes;
      }
      // Note: assignee_role is not stored - it's only used by AI for assignment decisions

      return {
        title: task.title,
        description: task.description || null,
        phase_number: task.phase_number,
        status: task.status,
        priority: task.priority,
        assignee_id: task.assignee_id || null, // Use AI-suggested assignee if provided
        parent_task_id: null,
        start_date: null, // Can be set by user in preview
        due_date: task.due_date,
        estimated_hours: task.estimated_hours || null,
        tags: task.tags || [],
        notes: JSON.stringify(notesData),
        dependencies: [],
        ai_generated: true,
        ai_analysis_id: null,
        duplicateStatus: 'unique', // Will be set by similarity detection
        existingTaskId: null, // Will be set by similarity detection
        requirements: task.requirements || [],
        userStories: task.userStories,
        previewId: `preview-${index}-${Date.now()}`, // Temporary ID for preview
      };
    });

    // Extract dates from the original prompt for additional context
    // This helps catch dates that might have been missed in task-specific extraction
    const dateExtraction = await extractDatesFromText(prompt, apiKey);
    
    // If we found dates in the prompt but tasks don't have dates, apply to first few tasks
    if (dateExtraction.dueDate && previewTasks.length > 0) {
      const tasksWithoutDates = previewTasks.filter((t) => !t.due_date);
      if (tasksWithoutDates.length > 0) {
        // Apply the earliest date to tasks without dates
        tasksWithoutDates.forEach((task) => {
          task.due_date = dateExtraction.dueDate;
        });
      }
    }

    return {
      tasks: previewTasks,
      summary: taskResult.summary,
    };
  } catch (error) {
    logger.error('[Task Generator] Error generating tasks:', error);
    throw new Error(
      `Failed to generate tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

