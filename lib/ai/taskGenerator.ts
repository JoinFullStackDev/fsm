import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';
import type { PreviewTask, SourceField } from '@/types/taskGenerator';
import { buildCompactSOWContext, type SOWMember, type SOWContextResult } from './promptTemplates';

/**
 * Expand short IDs (M1, M2, etc.) to full UUIDs using the mapping
 */
function expandShortIdToUUID(
  shortId: string | null | undefined,
  shortIdMap: Map<string, string>
): string | null {
  if (!shortId) return null;
  
  // Check if it's a short ID (M1, M2, etc.)
  const shortIdUpper = shortId.toUpperCase();
  if (shortIdMap.has(shortIdUpper)) {
    return shortIdMap.get(shortIdUpper) || null;
  }
  
  // Check if it's already a UUID (36 char format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(shortId)) {
    return shortId;
  }
  
  // Invalid format - return null
  logger.warn(`[Task Generator] Invalid assignee_id format: ${shortId}`);
  return null;
}

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
  response_time_ms?: number;
}

/**
 * Extract dates from text using AI (uses flash-lite for speed)
 */
export async function extractDatesFromText(
  text: string,
  apiKey: string
): Promise<{ dueDate: string | null; extractedDates: string[] }> {
  const today = new Date().toISOString().split('T')[0];
  
  const prompt = `Extract dates from text. Look for specific dates, relative dates ("in 2 weeks"), deadlines.

Text: "${text.substring(0, 500)}"

Return JSON: {"dates": ["YYYY-MM-DD"], "earliest": "YYYY-MM-DD" or null}
Today: ${today}`;

  try {
    const result = await generateStructuredAIResponse<{
      dates: string[];
      earliest: string | null;
    }>(
      prompt, 
      {}, 
      apiKey,
      undefined,
      false,
      'gemini-2.5-flash-lite' // Use faster model for simple extraction
    );

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

// Re-export SOWMember type for backwards compatibility
export type { SOWMember } from './promptTemplates';

/**
 * Build compact phase context for task generation
 */
function buildPhaseContext(phases: PhaseData[]): string {
  return phases.map(p => {
    const fieldKeys = Object.keys(p.data || {})
      .filter(k => !k.startsWith('_') && !['master_prompt', 'generated_document', 'document_generated_at'].includes(k));
    
    const status = p.completed ? ' ✓' : '';
    return `P${p.phase_number}:${p.phase_name || `Phase ${p.phase_number}`}${status} [${fieldKeys.slice(0, 5).join(', ')}${fieldKeys.length > 5 ? '...' : ''}]`;
  }).join('\n');
}

/**
 * Generate tasks from user prompt/PRD
 * OPTIMIZED: Compact prompts, flash-lite for date extraction, source field tracking
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
  const startTime = Date.now();
  
  // Build compact phase context
  const phaseContext = buildPhaseContext(phases);
  const phaseNumbers = phases.map(p => p.phase_number).join(', ');

  // Compact existing tasks summary (titles only, limited)
  const existingTasksContext = existingTasks.length > 0
    ? `\nEXISTING (avoid duplicates):\n${existingTasks.slice(0, 8).map(t => `- ${t.title}`).join('\n')}`
    : '';

  // Build compact SOW context with short ID mapping
  let sowContextResult: SOWContextResult = { promptText: '', shortIdMap: new Map() };
  if (sowMembers?.length) {
    sowContextResult = buildCompactSOWContext(sowMembers, phases);
  }

  // Start date extraction in parallel (with flash-lite)
  const dateExtractionPromise = extractDatesFromText(prompt, apiKey);
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // OPTIMIZED PROMPT - team context at TOP for better AI consideration
  const fullPrompt = `Generate tasks for "${projectName}" based on user input.
${sowContextResult.promptText}
USER INPUT:
${prompt.substring(0, 2000)}${prompt.length > 2000 ? '...' : ''}
${context ? `\nCONTEXT: ${context.substring(0, 500)}` : ''}

PHASES:
${phaseContext}
${existingTasksContext}

Generate tasks with these fields:
{
  "title": "Action verb + deliverable",
  "description": "What to do",
  "phase_number": ${phaseNumbers},
  "priority": "low|medium|high|critical",
  "status": "todo",
  "estimated_hours": 1-40,
  "tags": ["category"],
  "requirements": ["req1"],
  "userStories": ["As a user..."] (optional),
  "due_date": "YYYY-MM-DD" or null,
  "assignee_id": "M1, M2, etc. or null",
  "source_fields": [{"phase": N, "field": "field_key"}]
}

TODAY: ${today}

RULES:
1. Each task should link to relevant phase fields via source_fields
2. Assign tasks using team member short IDs (M1, M2, etc.) when role matches
3. Extract dates from input; if none found, set due_date to null
4. Estimated hours: Simple 1-4h, Medium 4-16h, Complex 16-40h

Return JSON: {"tasks": [...], "summary": "Brief summary"}`;

  try {
    // Run task generation and date extraction in parallel
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
          source_fields?: SourceField[];
        }>;
        summary?: string;
      }>(fullPrompt, {
        projectData: {
          name: projectName,
          phases: phases.map(p => ({
            phase_number: p.phase_number,
            phase_name: p.phase_name,
            completed: p.completed,
          })),
        },
      }, apiKey, projectName),
      dateExtractionPromise,
    ] as const);

    const taskResult = 'result' in result ? result.result : result;
    const responseTime = Date.now() - startTime;

    // Convert to PreviewTask format with short ID expansion
    const previewTasks: PreviewTask[] = taskResult.tasks.map((task, index) => {
      // Build notes JSONB structure
      const notesData: Record<string, unknown> = {
        requirements: task.requirements || [],
      };
      if (task.userStories?.length) {
        notesData.userStories = task.userStories;
      }
      if (task.notes) {
        notesData.notes = task.notes;
      }

      // Expand short IDs (M1, M2) to full UUIDs
      const expandedAssigneeId = expandShortIdToUUID(
        task.assignee_id,
        sowContextResult.shortIdMap
      );

      return {
        title: task.title,
        description: task.description || null,
        phase_number: task.phase_number,
        status: task.status,
        priority: task.priority,
        assignee_id: expandedAssigneeId,
        parent_task_id: null,
        start_date: null,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours || null,
        tags: task.tags || [],
        notes: JSON.stringify(notesData),
        dependencies: [],
        ai_generated: true,
        ai_analysis_id: null,
        duplicateStatus: 'unique',
        existingTaskId: null,
        requirements: task.requirements || [],
        userStories: task.userStories,
        previewId: `preview-${index}-${Date.now()}`,
        source_fields: task.source_fields,
      };
    });

    // Apply extracted dates to tasks without dates
    if (dateExtraction.dueDate) {
      previewTasks
        .filter(t => !t.due_date)
        .forEach(task => {
          task.due_date = dateExtraction.dueDate;
        });
    }

    return {
      tasks: previewTasks,
      summary: taskResult.summary,
      response_time_ms: responseTime,
    };
  } catch (error) {
    logger.error('[Task Generator] Error generating tasks:', error);
    throw new Error(`Failed to generate tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
