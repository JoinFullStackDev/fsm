import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';
import type { PreviewTask } from '@/types/taskGenerator';

/**
 * Merge AI-generated task content into existing task
 * Existing task remains unchanged except for notes - all AI suggestions are recorded there
 * This prevents confusion by not modifying the task's title, description, dates, etc.
 */
export function mergeTaskContent(
  existingTask: ProjectTask,
  aiTask: PreviewTask
): Partial<ProjectTask> {
  const updates: Partial<ProjectTask> = {};

  // Parse existing notes to preserve them
  const existingNotes = existingTask.notes ? parseNotes(existingTask.notes) : {};

  // Build AI suggestions summary to add to notes
  const aiSuggestions: Record<string, any> = {
    mergedAt: new Date().toISOString(),
    mergedFrom: 'ai-task-generator',
    aiTaskTitle: aiTask.title, // Record what the AI called this task
  };

  // Record AI description if different
  if (aiTask.description && aiTask.description !== existingTask.description) {
    aiSuggestions.aiDescription = aiTask.description;
  }

  // Record AI requirements
  const aiRequirements = aiTask.requirements || [];
  if (aiRequirements.length > 0) {
    aiSuggestions.aiRequirements = aiRequirements;
  }

  // Record AI user stories
  const aiUserStories = aiTask.userStories || [];
  if (aiUserStories.length > 0) {
    aiSuggestions.aiUserStories = aiUserStories;
  }

  // Record AI due date if different
  if (aiTask.due_date && aiTask.due_date !== existingTask.due_date) {
    aiSuggestions.aiDueDate = aiTask.due_date;
  }

  // Record AI start date if different
  if (aiTask.start_date && aiTask.start_date !== existingTask.start_date) {
    aiSuggestions.aiStartDate = aiTask.start_date;
  }

  // Record AI priority if different
  if (aiTask.priority && aiTask.priority !== existingTask.priority) {
    aiSuggestions.aiPriority = aiTask.priority;
  }

  // Record AI tags (new ones only)
  const existingTags = existingTask.tags || [];
  const newAiTags = (aiTask.tags || []).filter((tag) => !existingTags.includes(tag));
  if (newAiTags.length > 0) {
    aiSuggestions.aiTags = newAiTags;
  }

  // Record AI estimated hours if different
  if (aiTask.estimated_hours && aiTask.estimated_hours !== existingTask.estimated_hours) {
    aiSuggestions.aiEstimatedHours = aiTask.estimated_hours;
  }

  // Parse any notes from the AI task
  const aiNotes = aiTask.notes ? parseNotes(aiTask.notes) : {};
  if (aiNotes.notes || aiNotes.text) {
    aiSuggestions.aiNotes = aiNotes.notes || aiNotes.text;
  }

  // Build merged notes - preserve existing notes and add AI suggestions
  const mergedNotes: Record<string, any> = {
    ...existingNotes,
  };

  // Add or append to merge history
  if (!mergedNotes.aiMergeHistory) {
    mergedNotes.aiMergeHistory = [];
  }
  mergedNotes.aiMergeHistory.push(aiSuggestions);

  // Also merge requirements into existing (additive, deduplicated)
  const existingRequirements = Array.isArray(existingNotes.requirements)
    ? existingNotes.requirements
    : [];
  const mergedRequirements = [
    ...existingRequirements,
    ...aiRequirements.filter((req: string) => !existingRequirements.includes(req)),
  ];
  if (mergedRequirements.length > 0) {
    mergedNotes.requirements = mergedRequirements;
  }

  // Merge user stories (additive, deduplicated)
  const existingUserStories = Array.isArray(existingNotes.userStories)
    ? existingNotes.userStories
    : [];
  const mergedUserStories = [
    ...existingUserStories,
    ...aiUserStories.filter((story: string) => !existingUserStories.includes(story)),
  ];
  if (mergedUserStories.length > 0) {
    mergedNotes.userStories = mergedUserStories;
  }

  updates.notes = JSON.stringify(mergedNotes);

  // Mark as updated (only updating notes, not other fields)
  updates.updated_at = new Date().toISOString();

  logger.debug('[Task Merger] Merged AI suggestions into notes:', {
    existingTaskId: existingTask.id,
    existingTitle: existingTask.title,
    aiTitle: aiTask.title,
    suggestionsRecorded: Object.keys(aiSuggestions).length,
  });

  return updates;
}

/**
 * Parse notes field (can be JSON string or plain string)
 */
function parseNotes(notes: string | null): Record<string, any> {
  if (!notes) return {};

  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(notes);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (error) {
    // Not JSON, treat as plain text
  }

  // If not JSON, return as plain text in notes field
  return { notes: notes };
}

/**
 * Get requirements from task notes
 */
export function getRequirementsFromTask(task: ProjectTask | PreviewTask): string[] {
  if ('requirements' in task && Array.isArray(task.requirements)) {
    return task.requirements;
  }

  const notes = parseNotes(task.notes);
  return Array.isArray(notes.requirements) ? notes.requirements : [];
}

/**
 * Get user stories from task notes
 */
export function getUserStoriesFromTask(task: ProjectTask | PreviewTask): string[] {
  if ('userStories' in task && Array.isArray(task.userStories)) {
    return task.userStories;
  }

  const notes = parseNotes(task.notes);
  return Array.isArray(notes.userStories) ? notes.userStories : [];
}

