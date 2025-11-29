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
 * Generate tasks from user prompt/PRD
 */
export async function generateTasksFromPrompt(
  prompt: string,
  projectName: string,
  phases: PhaseData[],
  existingTasks: ProjectTask[],
  apiKey: string,
  context?: string
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

  const fullPrompt = `You are generating tasks for a project called "${projectName}" using The FullStack Method™ framework.

User Input/Prompt:
${prompt}
${context ? `\nAdditional Context:\n${context}` : ''}

Project Phases Available:
${phaseList}

${existingTasksContext}

Generate a comprehensive list of tasks based on the user's input. Each task should have:
- title: Clear, actionable task title
- description: Detailed description of what needs to be done
- phase_number: Which phase this task belongs to (must be one of: ${phases.map((p) => p.phase_number).join(', ')})
- priority: 'low', 'medium', 'high', or 'critical'
- status: 'todo' (for new tasks)
- tags: Array of relevant tags
- requirements: Array of specific requirements for this task (extracted from the prompt)
- userStories: Array of user stories if mentioned in the prompt (optional)
- notes: Additional notes or context

IMPORTANT: Extract dates from the user input. If dates are mentioned:
- Set due_date to the earliest date found
- If multiple dates are mentioned, use the earliest one
- If no dates are found, set due_date to null (user can set it later)
- Calculate relative dates from today: ${new Date().toISOString().split('T')[0]}

Return your response as JSON in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "phase_number": 1,
      "priority": "high",
      "status": "todo",
      "tags": ["tag1", "tag2"],
      "requirements": ["Requirement 1", "Requirement 2"],
      "userStories": ["As a user, I want..."],
      "notes": "Additional notes",
      "due_date": "2025-03-15" or null
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
        tags: string[];
        requirements: string[];
        userStories?: string[];
        notes?: string;
        due_date: string | null;
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

      return {
        title: task.title,
        description: task.description || null,
        phase_number: task.phase_number,
        status: task.status,
        priority: task.priority,
        assignee_id: null,
        parent_task_id: null,
        start_date: null, // Can be set by user in preview
        due_date: task.due_date,
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

