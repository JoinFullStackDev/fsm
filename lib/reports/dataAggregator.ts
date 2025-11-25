import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, addDays, isBefore, isAfter, parseISO } from 'date-fns';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';

export interface TaskMetrics {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  archived: number;
  byPhase: Record<number, number>;
  byPriority: Record<string, number>;
  byAssignee: Record<string, number>;
  overdue: number;
  upcomingDeadlines: number;
}

export interface WeeklyReportData {
  lastWeek: {
    start: Date;
    end: Date;
    tasks: (ProjectTask | ProjectTaskExtended)[];
    completed: (ProjectTask | ProjectTaskExtended)[];
  };
  thisWeek: {
    start: Date;
    end: Date;
    tasks: (ProjectTask | ProjectTaskExtended)[];
    upcoming: (ProjectTask | ProjectTaskExtended)[];
  };
  metrics: TaskMetrics;
}

export interface MonthlyReportData {
  month: {
    start: Date;
    end: Date;
    tasks: (ProjectTask | ProjectTaskExtended)[];
    completed: (ProjectTask | ProjectTaskExtended)[];
  };
  metrics: TaskMetrics;
}

export interface ForecastReportData {
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  tasks: (ProjectTask | ProjectTaskExtended)[];
  byAssignee: Record<string, (ProjectTask | ProjectTaskExtended)[]>;
  byPhase: Record<number, (ProjectTask | ProjectTaskExtended)[]>;
  byPriority: Record<string, (ProjectTask | ProjectTaskExtended)[]>;
  metrics: TaskMetrics;
}

/**
 * Get tasks for weekly report (last week + this week)
 */
export function getWeeklyTasks(
  tasks: (ProjectTask | ProjectTaskExtended)[],
  referenceDate: Date = new Date()
): WeeklyReportData {
  const lastWeekStart = startOfWeek(subWeeks(referenceDate, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(referenceDate, 1), { weekStartsOn: 1 });
  const thisWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });

  const lastWeekTasks = tasks.filter((task) => {
    if (!task.due_date && !task.start_date) return false;
    const taskDate = task.due_date ? parseISO(task.due_date) : parseISO(task.start_date!);
    return taskDate >= lastWeekStart && taskDate <= lastWeekEnd;
  });

  const thisWeekTasks = tasks.filter((task) => {
    if (!task.due_date && !task.start_date) return false;
    const taskDate = task.due_date ? parseISO(task.due_date) : parseISO(task.start_date!);
    return taskDate >= thisWeekStart && taskDate <= thisWeekEnd;
  });

  const lastWeekCompleted = lastWeekTasks.filter((task) => task.status === 'done');
  const thisWeekUpcoming = thisWeekTasks.filter((task) => task.status !== 'done');

  const allRelevantTasks = [...lastWeekTasks, ...thisWeekTasks];
  const uniqueTasks = Array.from(
    new Map(allRelevantTasks.map((task) => [task.id, task])).values()
  );

  return {
    lastWeek: {
      start: lastWeekStart,
      end: lastWeekEnd,
      tasks: lastWeekTasks,
      completed: lastWeekCompleted,
    },
    thisWeek: {
      start: thisWeekStart,
      end: thisWeekEnd,
      tasks: thisWeekTasks,
      upcoming: thisWeekUpcoming,
    },
    metrics: calculateMetrics(uniqueTasks),
  };
}

/**
 * Get tasks for monthly report (previous month)
 */
export function getMonthlyTasks(
  tasks: (ProjectTask | ProjectTaskExtended)[],
  referenceDate: Date = new Date()
): MonthlyReportData {
  const monthStart = startOfMonth(subMonths(referenceDate, 1));
  const monthEnd = endOfMonth(subMonths(referenceDate, 1));

  const monthTasks = tasks.filter((task) => {
    if (!task.due_date && !task.start_date && !task.created_at) return false;
    const taskDate = task.due_date
      ? parseISO(task.due_date)
      : task.start_date
      ? parseISO(task.start_date)
      : parseISO(task.created_at);
    return taskDate >= monthStart && taskDate <= monthEnd;
  });

  const completed = monthTasks.filter((task) => task.status === 'done');

  return {
    month: {
      start: monthStart,
      end: monthEnd,
      tasks: monthTasks,
      completed,
    },
    metrics: calculateMetrics(monthTasks),
  };
}

/**
 * Get tasks for forecast report (upcoming tasks within period)
 */
export function getForecastTasks(
  tasks: (ProjectTask | ProjectTaskExtended)[],
  days: number,
  referenceDate: Date = new Date()
): ForecastReportData {
  const periodStart = referenceDate;
  const periodEnd = addDays(referenceDate, days);

  const forecastTasks = tasks.filter((task) => {
    // Include tasks that are not done and have dates within the period
    if (task.status === 'done' || task.status === 'archived') return false;
    
    const taskDate = task.due_date ? parseISO(task.due_date) : task.start_date ? parseISO(task.start_date) : null;
    if (!taskDate) return false;
    
    return taskDate >= periodStart && taskDate <= periodEnd;
  });

  // Group by assignee
  const byAssignee: Record<string, (ProjectTask | ProjectTaskExtended)[]> = {};
  forecastTasks.forEach((task) => {
    const assigneeId = task.assignee_id || 'unassigned';
    if (!byAssignee[assigneeId]) {
      byAssignee[assigneeId] = [];
    }
    byAssignee[assigneeId].push(task);
  });

  // Group by phase
  const byPhase: Record<number, (ProjectTask | ProjectTaskExtended)[]> = {};
  forecastTasks.forEach((task) => {
    const phase = task.phase_number || 0;
    if (!byPhase[phase]) {
      byPhase[phase] = [];
    }
    byPhase[phase].push(task);
  });

  // Group by priority
  const byPriority: Record<string, (ProjectTask | ProjectTaskExtended)[]> = {};
  forecastTasks.forEach((task) => {
    const priority = task.priority || 'medium';
    if (!byPriority[priority]) {
      byPriority[priority] = [];
    }
    byPriority[priority].push(task);
  });

  return {
    period: {
      start: periodStart,
      end: periodEnd,
      days,
    },
    tasks: forecastTasks,
    byAssignee,
    byPhase,
    byPriority,
    metrics: calculateMetrics(forecastTasks),
  };
}

/**
 * Calculate task metrics
 */
function calculateMetrics(tasks: (ProjectTask | ProjectTaskExtended)[]): TaskMetrics {
  const metrics: TaskMetrics = {
    total: tasks.length,
    completed: 0,
    inProgress: 0,
    todo: 0,
    archived: 0,
    byPhase: {},
    byPriority: {},
    byAssignee: {},
    overdue: 0,
    upcomingDeadlines: 0,
  };

  const now = new Date();
  const sevenDaysFromNow = addDays(now, 7);

  tasks.forEach((task) => {
    // Count by status
    switch (task.status) {
      case 'done':
        metrics.completed++;
        break;
      case 'in_progress':
        metrics.inProgress++;
        break;
      case 'todo':
        metrics.todo++;
        break;
      case 'archived':
        metrics.archived++;
        break;
    }

    // Count by phase
    const phase = task.phase_number || 0;
    metrics.byPhase[phase] = (metrics.byPhase[phase] || 0) + 1;

    // Count by priority
    const priority = task.priority || 'medium';
    metrics.byPriority[priority] = (metrics.byPriority[priority] || 0) + 1;

    // Count by assignee
    const assigneeId = task.assignee_id || 'unassigned';
    metrics.byAssignee[assigneeId] = (metrics.byAssignee[assigneeId] || 0) + 1;

    // Check for overdue tasks
    if (task.due_date && task.status !== 'done') {
      const dueDate = parseISO(task.due_date);
      if (isBefore(dueDate, now)) {
        metrics.overdue++;
      } else if (isAfter(dueDate, now) && isBefore(dueDate, sevenDaysFromNow)) {
        metrics.upcomingDeadlines++;
      }
    }
  });

  return metrics;
}

