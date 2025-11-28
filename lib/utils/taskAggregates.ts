import type { ProjectTask, TaskStatus } from '@/types/project';

/**
 * Calculate parent task status based on subtask completion
 * - If all subtasks done → parent status = 'done'
 * - If any subtask in_progress → parent status = 'in_progress'
 * - Otherwise → parent status = 'todo'
 */
export function calculateParentTaskStatus(subtasks: ProjectTask[]): TaskStatus {
  if (subtasks.length === 0) {
    return 'todo';
  }

  const allDone = subtasks.every((task) => task.status === 'done');
  if (allDone) {
    return 'done';
  }

  const anyInProgress = subtasks.some((task) => task.status === 'in_progress');
  if (anyInProgress) {
    return 'in_progress';
  }

  return 'todo';
}

/**
 * Calculate parent task progress based on subtask completion
 */
export function calculateParentTaskProgress(
  subtasks: ProjectTask[]
): { completed: number; total: number; percentage: number } {
  if (subtasks.length === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const completed = subtasks.filter((task) => task.status === 'done').length;
  const total = subtasks.length;
  const percentage = Math.round((completed / total) * 100);

  return { completed, total, percentage };
}

/**
 * Get aggregate information for a parent task
 */
export function getParentTaskAggregateInfo(
  task: ProjectTask,
  subtasks: ProjectTask[]
): { status: TaskStatus; progress: number; summary: string } {
  const progress = calculateParentTaskProgress(subtasks);
  const status = calculateParentTaskStatus(subtasks);

  let summary = '';
  if (subtasks.length === 0) {
    summary = 'No subtasks';
  } else {
    summary = `${progress.completed} of ${progress.total} subtasks complete`;
  }

  return {
    status,
    progress: progress.percentage,
    summary,
  };
}

