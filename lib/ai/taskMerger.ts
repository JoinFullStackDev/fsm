import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';
import type { PreviewTask } from '@/types/taskGenerator';

/**
 * Merge AI-generated task content into existing task
 * Existing task remains the parent (keeps ID, created_at, etc.)
 */
export function mergeTaskContent(
  existingTask: ProjectTask,
  aiTask: PreviewTask
): Partial<ProjectTask> {
  const updates: Partial<ProjectTask> = {};

  // Merge description: append if different
  if (aiTask.description && aiTask.description !== existingTask.description) {
    if (existingTask.description) {
      // Append new description if existing has one
      updates.description = `${existingTask.description}\n\n--- Merged from AI ---\n\n${aiTask.description}`;
    } else {
      // Use AI description if existing doesn't have one
      updates.description = aiTask.description;
    }
  }

  // Merge notes: combine requirements and other notes
  const existingNotes = existingTask.notes ? parseNotes(existingTask.notes) : {};
  const aiNotes = aiTask.notes ? parseNotes(aiTask.notes) : {};

  // Merge requirements arrays
  const existingRequirements = Array.isArray(existingNotes.requirements)
    ? existingNotes.requirements
    : [];
  const aiRequirements = aiTask.requirements || [];
  
  // Combine and deduplicate requirements
  const mergedRequirements = [
    ...existingRequirements,
    ...aiRequirements.filter((req) => !existingRequirements.includes(req)),
  ];

  // Merge user stories if present
  const existingUserStories = Array.isArray(existingNotes.userStories)
    ? existingNotes.userStories
    : [];
  const aiUserStories = aiTask.userStories || [];
  const mergedUserStories = [
    ...existingUserStories,
    ...aiUserStories.filter((story) => !existingUserStories.includes(story)),
  ];

  // Build merged notes object
  const mergedNotes: Record<string, any> = {
    ...existingNotes,
    requirements: mergedRequirements,
  };

  if (mergedUserStories.length > 0) {
    mergedNotes.userStories = mergedUserStories;
  }

  // Preserve any other notes from existing task
  if (existingNotes.notes) {
    mergedNotes.notes = existingNotes.notes;
  }
  if (aiNotes.notes) {
    mergedNotes.notes = mergedNotes.notes
      ? `${mergedNotes.notes}\n\n--- Merged from AI ---\n\n${aiNotes.notes}`
      : aiNotes.notes;
  }

  // Add merge metadata
  mergedNotes.mergedAt = new Date().toISOString();
  mergedNotes.mergedFrom = 'ai-task-generator';

  updates.notes = JSON.stringify(mergedNotes);

  // Merge due_date: only if existing task doesn't have one
  if (!existingTask.due_date && aiTask.due_date) {
    updates.due_date = aiTask.due_date;
  }

  // Merge tags: combine and deduplicate
  const existingTags = existingTask.tags || [];
  const aiTags = aiTask.tags || [];
  const mergedTags = [
    ...existingTags,
    ...aiTags.filter((tag) => !existingTags.includes(tag)),
  ];
  if (mergedTags.length > 0) {
    updates.tags = mergedTags;
  }

  // Update priority if AI task has higher priority
  const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
  if (
    aiTask.priority &&
    priorityOrder[aiTask.priority] > priorityOrder[existingTask.priority]
  ) {
    updates.priority = aiTask.priority;
  }

  // Mark as updated
  updates.updated_at = new Date().toISOString();

  logger.debug('[Task Merger] Merged task content:', {
    existingTaskId: existingTask.id,
    updates: Object.keys(updates),
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

