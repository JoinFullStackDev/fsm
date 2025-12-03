import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';
import type { PreviewTask } from '@/types/taskGenerator';
import { computePhaseRoleMapping } from './phaseRoleMapping';
import { buildSOWMembersContext } from './promptTemplates';

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
  // Build phase context (optimized: summary instead of full data)
  const phaseList = phases
    .map((p) => `Phase ${p.phase_number}: ${p.phase_name || `Phase ${p.phase_number}`}${p.completed ? ' (Completed)' : ''}`)
    .join(', ');

  // Build existing tasks context for AI to avoid duplicates (optimized: reduced from 20 to 10, titles only)
  const existingTasksContext = existingTasks.length > 0
    ? `\n\nExisting tasks in this project (avoid creating exact duplicates):\n${existingTasks
        .slice(0, 10) // Reduced from 20 to 10 for faster processing
        .map((t) => `- ${t.title}`) // Removed description to save tokens
        .join('\n')}`
    : '';

  // Use cached phase role mapping utility
  const phaseRoleMapping = computePhaseRoleMapping(phases);

  // Build SOW members context using shared utility
  const sowMembersContext = sowMembers && sowMembers.length > 0
    ? buildSOWMembersContext(sowMembers, phases)
    : '';

  // PARALLELIZE: Start date extraction in parallel with task generation
  const dateExtractionPromise = extractDatesFromText(prompt, apiKey);

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
    // PARALLELIZE: Wait for both task generation and date extraction simultaneously
    const [result, dateExtraction] = await Promise.all([
      generateStructuredAIResponse<{
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
        // Summarize phase data instead of full JSON (optimized for token efficiency)
        phases: phases.map((p) => ({
          phase_number: p.phase_number,
          phase_name: p.phase_name,
          completed: p.completed,
          field_count: Object.keys(p.data || {}).length, // Include field count instead of full data
        })),
      },
    }, apiKey, projectName),
      dateExtractionPromise, // Parallel date extraction
    ] as const);

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

    // Use the date extraction result (already completed in parallel)
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

