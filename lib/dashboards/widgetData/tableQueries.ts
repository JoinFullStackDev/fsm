/**
 * Table widget data queries
 * Functions to fetch data for table widgets (task lists, opportunity pipelines, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';

export interface TableWidgetData {
  columns: string[];
  rows: Record<string, any>[];
  total?: number;
}

/**
 * Get tasks table data
 * Optimized to reduce N+1 query pattern by fetching projects once
 * Note: Still uses PostgREST for joins with users and projects tables
 */
export async function getTasksTable(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    projectId?: string;
    limit?: number;
    status?: string[];
    assigneeId?: string;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<TableWidgetData> {
  try {
    // Get project IDs first (only if not filtering by specific project)
    let projectIds: string[] | null = null;
    if (!options?.projectId) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId);

      if (!projects || projects.length === 0) {
        return { columns: ['Title', 'Status', 'Priority', 'Due Date', 'Assignee', 'Project'], rows: [] };
      }
      projectIds = projects.map(p => p.id);
    }

    let query = supabase
      .from('project_tasks')
      .select(`
        id,
        title,
        status,
        priority,
        due_date,
        assignee:users!project_tasks_assignee_id_fkey(id, name),
        project:projects!project_tasks_project_id_fkey(id, name)
      `);

    // Filter by organization via projects
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    } else if (projectIds) {
      query = query.in('project_id', projectIds);
    } else {
      return { columns: ['Title', 'Status', 'Priority', 'Due Date', 'Assignee', 'Project'], rows: [] };
    }

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }

    if (options?.assigneeId) {
      query = query.eq('assignee_id', options.assigneeId);
    }

    // Ordering
    const orderBy = options?.orderBy || 'created_at';
    const orderDirection = options?.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    // Limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error('[Table Queries] Error fetching tasks:', error);
      return { columns: ['Title', 'Status', 'Priority', 'Due Date', 'Assignee', 'Project'], rows: [] };
    }

    const rows = (tasks || []).map((task: any) => ({
      id: task.id,
      'Title': task.title,
      'Status': task.status,
      'Priority': task.priority || 'medium',
      'Due Date': task.due_date ? new Date(task.due_date).toLocaleDateString() : '-',
      'Assignee': task.assignee?.name || 'Unassigned',
      'Project': task.project?.name || '-',
    }));

    return {
      columns: ['Title', 'Status', 'Priority', 'Due Date', 'Assignee', 'Project'],
      rows,
      total: rows.length,
    };
  } catch (error) {
    logger.error('[Table Queries] Error in getTasksTable:', error);
    return { columns: ['Title', 'Status', 'Priority', 'Due Date', 'Assignee', 'Project'], rows: [] };
  }
}

/**
 * Get projects table data
 */
export async function getProjectsTable(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    limit?: number;
    status?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<TableWidgetData> {
  try {
    let query = supabase
      .from('projects')
      .select(`
        id,
        name,
        status,
        created_at,
        updated_at,
        owner:users!projects_owner_id_fkey(id, name)
      `)
      .eq('organization_id', organizationId);

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }

    // Ordering
    const orderBy = options?.orderBy || 'updated_at';
    const orderDirection = options?.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    // Limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: projects, error } = await query;

    if (error) {
      logger.error('[Table Queries] Error fetching projects:', error);
      return { columns: ['Name', 'Status', 'Owner', 'Created', 'Updated'], rows: [] };
    }

    const rows = (projects || []).map((project: any) => ({
      id: project.id,
      'Name': project.name,
      'Status': project.status,
      'Owner': project.owner?.name || '-',
      'Created': new Date(project.created_at).toLocaleDateString(),
      'Updated': new Date(project.updated_at).toLocaleDateString(),
    }));

    return {
      columns: ['Name', 'Status', 'Owner', 'Created', 'Updated'],
      rows,
      total: rows.length,
    };
  } catch (error) {
    logger.error('[Table Queries] Error in getProjectsTable:', error);
    return { columns: ['Name', 'Status', 'Owner', 'Created', 'Updated'], rows: [] };
  }
}

/**
 * Get opportunities table data (Ops Tool)
 */
export async function getOpportunitiesTable(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    limit?: number;
    status?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<TableWidgetData> {
  try {
    // First, get opportunities with company info
    let query = supabase
      .from('opportunities')
      .select(`
        id,
        name,
        status,
        value,
        probability,
        company_id,
        company:companies(id, name),
        created_at
      `)
      .eq('organization_id', organizationId);

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }

    // Ordering
    const orderBy = options?.orderBy || 'created_at';
    const orderDirection = options?.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    // Limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: opportunities, error } = await query;

    if (error) {
      logger.error('[Table Queries] Error fetching opportunities:', error);
      return { columns: ['Name', 'Status', 'Value', 'Probability', 'Company', 'Contact'], rows: [] };
    }

    // Get contacts for all companies that have opportunities
    const companyIds = [...new Set((opportunities || [])
      .map((opp: any) => opp.company_id)
      .filter(Boolean))];

    let contactsMap = new Map<string, any>();
    if (companyIds.length > 0) {
      // Get primary contact (first contact) for each company
      const { data: contacts } = await supabase
        .from('company_contacts')
        .select('id, company_id, first_name, last_name, email')
        .in('company_id', companyIds)
        .order('created_at', { ascending: true });

      if (contacts) {
        // Group by company_id and take the first contact for each company
        contacts.forEach((contact: any) => {
          if (!contactsMap.has(contact.company_id)) {
            contactsMap.set(contact.company_id, contact);
          }
        });
      }
    }

    const rows = (opportunities || []).map((opp: any) => {
      const contact = opp.company_id ? contactsMap.get(opp.company_id) : null;
      const contactName = contact 
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email
        : '-';
      
      return {
        id: opp.id,
        'Name': opp.name,
        'Status': opp.status,
        'Value': opp.value ? `$${opp.value.toLocaleString()}` : '-',
        'Probability': opp.probability ? `${opp.probability}%` : '-',
        'Company': opp.company?.name || '-',
        'Contact': contactName,
      };
    });

    return {
      columns: ['Name', 'Status', 'Value', 'Probability', 'Company', 'Contact'],
      rows,
      total: rows.length,
    };
  } catch (error) {
    logger.error('[Table Queries] Error in getOpportunitiesTable:', error);
    return { columns: ['Name', 'Status', 'Value', 'Probability', 'Company', 'Contact'], rows: [] };
  }
}

/**
 * Get companies table data (Ops Tool)
 */
export async function getCompaniesTable(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    limit?: number;
    status?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<TableWidgetData> {
  try {
    let query = supabase
      .from('companies')
      .select(`
        id,
        name,
        status,
        website,
        industry,
        created_at
      `)
      .eq('organization_id', organizationId);

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }

    // Ordering
    const orderBy = options?.orderBy || 'created_at';
    const orderDirection = options?.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    // Limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: companies, error } = await query;

    if (error) {
      logger.error('[Table Queries] Error fetching companies:', error);
      return { columns: ['Name', 'Status', 'Website', 'Industry'], rows: [] };
    }

    const rows = (companies || []).map((company: any) => ({
      id: company.id,
      'Name': company.name,
      'Status': company.status,
      'Website': company.website || '-',
      'Industry': company.industry || '-',
    }));

    return {
      columns: ['Name', 'Status', 'Website', 'Industry'],
      rows,
      total: rows.length,
    };
  } catch (error) {
    logger.error('[Table Queries] Error in getCompaniesTable:', error);
    return { columns: ['Name', 'Status', 'Website', 'Industry'], rows: [] };
  }
}

/**
 * Get recent activity table data
 */
export async function getRecentActivityTable(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    limit?: number;
    actionTypes?: string[];
  }
): Promise<TableWidgetData> {
  try {
    // Get all users in organization
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    if (!users || users.length === 0) {
      return { columns: ['Action', 'Description', 'User', 'Time'], rows: [] };
    }

    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        action_type,
        resource_type,
        resource_id,
        metadata,
        created_at,
        user:users!activity_logs_user_id_fkey(id, name)
      `)
      .in('user_id', users.map(u => u.id));

    if (options?.actionTypes && options.actionTypes.length > 0) {
      query = query.in('action_type', options.actionTypes);
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: activities, error } = await query;

    if (error) {
      logger.error('[Table Queries] Error fetching recent activity:', error);
      return { columns: ['Action', 'Description', 'User', 'Time'], rows: [] };
    }

    // Helper function to generate description from activity data
    const getActivityDescription = (activity: any): string => {
      const action = activity.action_type || '';
      const resourceType = activity.resource_type || '';
      const resourceId = activity.resource_id || '';
      const metadata = activity.metadata || {};
      
      // Try to extract meaningful info from metadata
      if (metadata.name) {
        return `${action} ${metadata.name}`;
      }
      if (metadata.title) {
        return `${action} ${metadata.title}`;
      }
      if (resourceType && resourceId) {
        return `${action} ${resourceType} ${resourceId.substring(0, 8)}...`;
      }
      return action || 'Activity';
    };

    const rows = (activities || []).map((activity: any) => ({
      id: activity.id,
      'Action': activity.action_type,
      'Description': getActivityDescription(activity),
      'User': activity.user?.name || 'Unknown',
      'Time': new Date(activity.created_at).toLocaleString(),
    }));

    return {
      columns: ['Action', 'Description', 'User', 'Time'],
      rows,
      total: rows.length,
    };
  } catch (error) {
    logger.error('[Table Queries] Error in getRecentActivityTable:', error);
    return { columns: ['Action', 'Description', 'User', 'Time'], rows: [] };
  }
}

