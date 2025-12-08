/**
 * Chart widget data queries
 * Functions to fetch data for chart widgets (line, bar, pie, area charts)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import type { ChartDataPoint, ChartWidgetData as BaseChartWidgetData } from '@/types/database';

// Re-export for backward compatibility
export type { ChartDataPoint };

// Extended ChartWidgetData with yAxis support
export interface ChartWidgetData extends BaseChartWidgetData {
  yAxis?: string;
}

// Local query result interfaces
interface TaskCreatedAtResult {
  created_at: string;
}

interface PhaseCompletedResult {
  updated_at: string;
  completed: boolean;
}

interface TaskStatusResult {
  status: string;
}

interface TaskPriorityResult {
  priority: string | null;
}

interface ActivityLogResult {
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface ExportResult {
  created_at: string;
  export_type: string;
}

/**
 * Get task timeline data (tasks created over time)
 */
export async function getTaskTimeline(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    projectId?: string;
    dateRange?: { start: string; end: string };
    groupBy?: 'day' | 'week' | 'month';
  }
): Promise<ChartWidgetData> {
  try {
    let query = supabase
      .from('project_tasks')
      .select('created_at');

    // Filter by organization via projects
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (projects && projects.length > 0) {
        query = query.in('project_id', projects.map(p => p.id));
      } else {
        return { data: [] };
      }
    }

    if (options?.dateRange) {
      if (options.dateRange.start) {
        query = query.gte('created_at', options.dateRange.start);
      }
      if (options.dateRange.end) {
        query = query.lte('created_at', options.dateRange.end);
      }
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching task timeline:', error);
      return { data: [] };
    }

    if (!tasks || tasks.length === 0) {
      return { data: [] };
    }

    // Group by date
    const groupBy = options?.groupBy || 'day';
    const grouped: Record<string, number> = {};

    (tasks as TaskCreatedAtResult[]).forEach((task) => {
      const date = new Date(task.created_at);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    const data = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data,
      xAxis: 'Date',
      yAxis: 'Tasks',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getTaskTimeline:', error);
    return { data: [] };
  }
}

/**
 * Get phase completion timeline
 */
export async function getPhaseCompletionTimeline(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    projectId?: string;
    dateRange?: { start: string; end: string };
  }
): Promise<ChartWidgetData> {
  try {
    let query = supabase
      .from('project_phases')
      .select('updated_at, completed')
      .eq('completed', true);

    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (projects && projects.length > 0) {
        query = query.in('project_id', projects.map(p => p.id));
      } else {
        return { data: [] };
      }
    }

    if (options?.dateRange) {
      if (options.dateRange.start) {
        query = query.gte('updated_at', options.dateRange.start);
      }
      if (options.dateRange.end) {
        query = query.lte('updated_at', options.dateRange.end);
      }
    }

    const { data: phases, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching phase completion timeline:', error);
      return { data: [] };
    }

    if (!phases || phases.length === 0) {
      return { data: [] };
    }

    // Group by date
    const grouped: Record<string, number> = {};

    (phases as PhaseCompletedResult[]).forEach((phase) => {
      const date = new Date(phase.updated_at);
      const key = date.toISOString().split('T')[0];
      grouped[key] = (grouped[key] || 0) + 1;
    });

    const data = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data,
      xAxis: 'Date',
      yAxis: 'Phases Completed',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getPhaseCompletionTimeline:', error);
    return { data: [] };
  }
}

/**
 * Get task status distribution
 */
export async function getTaskStatusDistribution(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    projectId?: string;
  }
): Promise<ChartWidgetData> {
  try {
    let query = supabase
      .from('project_tasks')
      .select('status');

    // Filter by organization via projects
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (projects && projects.length > 0) {
        query = query.in('project_id', projects.map(p => p.id));
      } else {
        return { data: [] };
      }
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching task status distribution:', error);
      return { data: [] };
    }

    if (!tasks || tasks.length === 0) {
      return { data: [] };
    }

    // Count by status
    const grouped: Record<string, number> = {};
    (tasks as TaskStatusResult[]).forEach((task) => {
      const status = task.status || 'unknown';
      grouped[status] = (grouped[status] || 0) + 1;
    });

    const data = Object.entries(grouped).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    return {
      data,
      xAxis: 'Status',
      yAxis: 'Count',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getTaskStatusDistribution:', error);
    return { data: [] };
  }
}

/**
 * Get task priority distribution
 */
export async function getTaskPriorityDistribution(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    projectId?: string;
  }
): Promise<ChartWidgetData> {
  try {
    let query = supabase
      .from('project_tasks')
      .select('priority');

    // Filter by organization via projects
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (projects && projects.length > 0) {
        query = query.in('project_id', projects.map(p => p.id));
      } else {
        return { data: [] };
      }
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching task priority distribution:', error);
      return { data: [] };
    }

    if (!tasks || tasks.length === 0) {
      return { data: [] };
    }

    // Count by priority
    const grouped: Record<string, number> = {};
    (tasks as TaskPriorityResult[]).forEach((task) => {
      const priority = task.priority || 'medium';
      grouped[priority] = (grouped[priority] || 0) + 1;
    });

    const data = Object.entries(grouped).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    return {
      data,
      xAxis: 'Priority',
      yAxis: 'Count',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getTaskPriorityDistribution:', error);
    return { data: [] };
  }
}

/**
 * Get phase status distribution
 */
export async function getPhaseStatusDistribution(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    projectId?: string;
  }
): Promise<ChartWidgetData> {
  try {
    let query = supabase
      .from('project_phases')
      .select('completed');

    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (projects && projects.length > 0) {
        query = query.in('project_id', projects.map(p => p.id));
      } else {
        return { data: [] };
      }
    }

    const { data: phases, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching phase status distribution:', error);
      return { data: [] };
    }

    if (!phases || phases.length === 0) {
      return { data: [] };
    }

    const completed = (phases as PhaseCompletedResult[]).filter((p) => p.completed === true).length;
    const incomplete = phases.length - completed;

    const data = [
      { name: 'Completed', value: completed },
      { name: 'In Progress', value: incomplete },
    ];

    return {
      data,
      xAxis: 'Status',
      yAxis: 'Count',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getPhaseStatusDistribution:', error);
    return { data: [] };
  }
}

/**
 * Get AI usage timeline
 */
export async function getAIUsageTimeline(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    dateRange?: { start: string; end: string };
    groupBy?: 'day' | 'week' | 'month';
  }
): Promise<ChartWidgetData> {
  try {
    // Get all users in organization
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    if (!users || users.length === 0) {
      return { data: [] };
    }

    // AI action types that should be tracked
    const AI_ACTION_TYPES = [
      'ai_used',
      'ai_generate',
      'project_analyze',
      'tasks_generated',
      'ai_task_generation',
    ];

    let query = supabase
      .from('activity_logs')
      .select('created_at, metadata')
      .in('action_type', AI_ACTION_TYPES)
      .in('user_id', users.map(u => u.id));

    if (options?.dateRange) {
      if (options.dateRange.start) {
        query = query.gte('created_at', options.dateRange.start);
      }
      if (options.dateRange.end) {
        query = query.lte('created_at', options.dateRange.end);
      }
    }

    const { data: logs, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching AI usage timeline:', error);
      return { data: [] };
    }

    if (!logs || logs.length === 0) {
      return { data: [] };
    }

    // Group by date and sum tokens
    const groupBy = options?.groupBy || 'day';
    const grouped: Record<string, number> = {};

    (logs as ActivityLogResult[]).forEach((log) => {
      const date = new Date(log.created_at);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const metadata = (log.metadata || {}) as Record<string, unknown>;
      // Try multiple ways to extract token count
      let tokens = 0;
      if (typeof metadata.total_tokens === 'number') {
        tokens = metadata.total_tokens;
      } else if (typeof metadata.input_tokens === 'number' && typeof metadata.output_tokens === 'number') {
        tokens = metadata.input_tokens + metadata.output_tokens;
      } else if (typeof metadata.input_tokens === 'number') {
        tokens = metadata.input_tokens;
      } else if (typeof metadata.output_tokens === 'number') {
        tokens = metadata.output_tokens;
      } else if (typeof metadata.tokens === 'number') {
        tokens = metadata.tokens;
      }
      
      grouped[key] = (grouped[key] || 0) + tokens;
    });

    const data = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data,
      xAxis: 'Date',
      yAxis: 'Tokens',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getAIUsageTimeline:', error);
    return { data: [] };
  }
}

/**
 * Get export timeline
 */
export async function getExportTimeline(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    dateRange?: { start: string; end: string };
    groupBy?: 'day' | 'week' | 'month';
  }
): Promise<ChartWidgetData> {
  try {
    // Get all projects for organization
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId);

    if (!projects || projects.length === 0) {
      return { data: [] };
    }

    let query = supabase
      .from('exports')
      .select('created_at, export_type')
      .in('project_id', projects.map(p => p.id));

    if (options?.dateRange) {
      if (options.dateRange.start) {
        query = query.gte('created_at', options.dateRange.start);
      }
      if (options.dateRange.end) {
        query = query.lte('created_at', options.dateRange.end);
      }
    }

    const { data: exports, error } = await query;

    if (error) {
      logger.error('[Chart Queries] Error fetching export timeline:', error);
      return { data: [] };
    }

    if (!exports || exports.length === 0) {
      return { data: [] };
    }

    // Group by date
    const groupBy = options?.groupBy || 'day';
    const grouped: Record<string, number> = {};

    (exports as ExportResult[]).forEach((exp) => {
      const date = new Date(exp.created_at);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    const data = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data,
      xAxis: 'Date',
      yAxis: 'Exports',
    };
  } catch (error) {
    logger.error('[Chart Queries] Error in getExportTimeline:', error);
    return { data: [] };
  }
}

