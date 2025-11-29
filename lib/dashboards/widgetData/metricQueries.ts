/**
 * Metric widget data queries
 * Functions to fetch data for metric widgets (counts, totals, percentages)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';

export interface MetricWidgetData {
  value: number;
  label: string;
  change?: number;
  changeLabel?: string;
}

/**
 * Get task count metric
 */
export async function getTaskCount(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: {
    projectId?: string;
    status?: string[];
    assigneeId?: string;
    dueDateRange?: { start: string; end: string };
  }
): Promise<MetricWidgetData> {
  try {
    let query = supabase
      .from('project_tasks')
      .select('id', { count: 'exact', head: true });

    // Filter by organization via projects
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (projects && projects.length > 0) {
        query = query.in('project_id', projects.map(p => p.id));
      } else {
        return { value: 0, label: 'Tasks' };
      }
    }

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.assigneeId) {
      query = query.eq('assignee_id', filters.assigneeId);
    }

    if (filters?.dueDateRange) {
      if (filters.dueDateRange.start) {
        query = query.gte('due_date', filters.dueDateRange.start);
      }
      if (filters.dueDateRange.end) {
        query = query.lte('due_date', filters.dueDateRange.end);
      }
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching task count:', error);
      return { value: 0, label: 'Tasks' };
    }

    return {
      value: count || 0,
      label: 'Tasks',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getTaskCount:', error);
    return { value: 0, label: 'Tasks' };
  }
}

/**
 * Get project count metric
 */
export async function getProjectCount(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: {
    status?: string[];
  }
): Promise<MetricWidgetData> {
  try {
    let query = supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching project count:', error);
      return { value: 0, label: 'Projects' };
    }

    return {
      value: count || 0,
      label: 'Projects',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getProjectCount:', error);
    return { value: 0, label: 'Projects' };
  }
}

/**
 * Get tasks due today metric
 */
export async function getTasksDueToday(
  supabase: SupabaseClient,
  organizationId: string,
  assigneeId?: string
): Promise<MetricWidgetData> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all projects for organization
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId);

    if (!projects || projects.length === 0) {
      return { value: 0, label: 'Tasks Due Today' };
    }

    let query = supabase
      .from('project_tasks')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projects.map(p => p.id))
      .gte('due_date', today.toISOString().split('T')[0])
      .lt('due_date', tomorrow.toISOString().split('T')[0])
      .in('status', ['todo', 'in_progress']);

    if (assigneeId) {
      query = query.eq('assignee_id', assigneeId);
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching tasks due today:', error);
      return { value: 0, label: 'Tasks Due Today' };
    }

    return {
      value: count || 0,
      label: 'Tasks Due Today',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getTasksDueToday:', error);
    return { value: 0, label: 'Tasks Due Today' };
  }
}

/**
 * Get overdue tasks metric
 */
export async function getOverdueTasks(
  supabase: SupabaseClient,
  organizationId: string,
  assigneeId?: string
): Promise<MetricWidgetData> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all projects for organization
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId);

    if (!projects || projects.length === 0) {
      return { value: 0, label: 'Overdue Tasks' };
    }

    let query = supabase
      .from('project_tasks')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projects.map(p => p.id))
      .lt('due_date', today.toISOString().split('T')[0])
      .in('status', ['todo', 'in_progress']);

    if (assigneeId) {
      query = query.eq('assignee_id', assigneeId);
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching overdue tasks:', error);
      return { value: 0, label: 'Overdue Tasks' };
    }

    return {
      value: count || 0,
      label: 'Overdue Tasks',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getOverdueTasks:', error);
    return { value: 0, label: 'Overdue Tasks' };
  }
}

/**
 * Get phase completion percentage
 */
export async function getPhaseCompletion(
  supabase: SupabaseClient,
  organizationId: string,
  projectId?: string
): Promise<MetricWidgetData> {
  try {
    let query = supabase
      .from('project_phases')
      .select('completed');

    if (projectId) {
      query = query.eq('project_id', projectId);
    } else {
      // Get all projects for organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (!projects || projects.length === 0) {
        return { value: 0, label: 'Phase Completion' };
      }

      query = query.in('project_id', projects.map(p => p.id));
    }

    const { data: phases, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching phase completion:', error);
      return { value: 0, label: 'Phase Completion' };
    }

    if (!phases || phases.length === 0) {
      return { value: 0, label: 'Phase Completion' };
    }

    const completed = phases.filter(p => p.completed === true).length;
    const percentage = Math.round((completed / phases.length) * 100);

    return {
      value: percentage,
      label: 'Phase Completion',
      changeLabel: `${completed}/${phases.length} phases`,
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getPhaseCompletion:', error);
    return { value: 0, label: 'Phase Completion' };
  }
}

/**
 * Get AI tokens used metric
 */
export async function getAITokensUsed(
  supabase: SupabaseClient,
  organizationId: string,
  dateRange?: { start: string; end: string }
): Promise<MetricWidgetData> {
  try {
    // Get all users in organization
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    if (!users || users.length === 0) {
      return { value: 0, label: 'AI Tokens Used' };
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
      .select('metadata')
      .in('action_type', AI_ACTION_TYPES)
      .in('user_id', users.map(u => u.id));

    if (dateRange) {
      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end);
      }
    }

    const { data: logs, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching AI tokens:', error);
      return { value: 0, label: 'AI Tokens Used' };
    }

    if (!logs || logs.length === 0) {
      return { value: 0, label: 'AI Tokens Used' };
    }

    // Sum up total tokens from metadata
    let totalTokens = 0;
    logs.forEach((log: any) => {
      const metadata = log.metadata || {};
      // Try multiple ways to extract token count
      let tokens = 0;
      if (metadata.total_tokens) {
        tokens = metadata.total_tokens;
      } else if (metadata.input_tokens && metadata.output_tokens) {
        tokens = metadata.input_tokens + metadata.output_tokens;
      } else if (typeof metadata.input_tokens === 'number') {
        tokens = metadata.input_tokens;
      } else if (typeof metadata.output_tokens === 'number') {
        tokens = metadata.output_tokens;
      } else if (typeof metadata.tokens === 'number') {
        tokens = metadata.tokens;
      }
      totalTokens += tokens;
    });

    return {
      value: totalTokens,
      label: 'AI Tokens Used',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getAITokensUsed:', error);
    return { value: 0, label: 'AI Tokens Used' };
  }
}

/**
 * Get export count metric
 */
export async function getExportCount(
  supabase: SupabaseClient,
  organizationId: string,
  dateRange?: { start: string; end: string }
): Promise<MetricWidgetData> {
  try {
    // Get all projects for organization
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId);

    if (!projects || projects.length === 0) {
      return { value: 0, label: 'Exports' };
    }

    let query = supabase
      .from('exports')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projects.map(p => p.id));

    if (dateRange) {
      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end);
      }
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching export count:', error);
      return { value: 0, label: 'Exports' };
    }

    return {
      value: count || 0,
      label: 'Exports',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getExportCount:', error);
    return { value: 0, label: 'Exports' };
  }
}

/**
 * Get user count metric
 */
export async function getUserCount(
  supabase: SupabaseClient,
  organizationId: string
): Promise<MetricWidgetData> {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('[Metric Queries] Error fetching user count:', error);
      return { value: 0, label: 'Users' };
    }

    return {
      value: count || 0,
      label: 'Users',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getUserCount:', error);
    return { value: 0, label: 'Users' };
  }
}

/**
 * Get opportunity count metric (Ops Tool)
 */
export async function getOpportunityCount(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: {
    status?: string[];
  }
): Promise<MetricWidgetData> {
  try {
    let query = supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching opportunity count:', error);
      return { value: 0, label: 'Opportunities' };
    }

    return {
      value: count || 0,
      label: 'Opportunities',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getOpportunityCount:', error);
    return { value: 0, label: 'Opportunities' };
  }
}

/**
 * Get company count metric (Ops Tool)
 */
export async function getCompanyCount(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: {
    status?: string[];
  }
): Promise<MetricWidgetData> {
  try {
    let query = supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const { count, error } = await query;

    if (error) {
      logger.error('[Metric Queries] Error fetching company count:', error);
      return { value: 0, label: 'Companies' };
    }

    return {
      value: count || 0,
      label: 'Companies',
    };
  } catch (error) {
    logger.error('[Metric Queries] Error in getCompanyCount:', error);
    return { value: 0, label: 'Companies' };
  }
}

