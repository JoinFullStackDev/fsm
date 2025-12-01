import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import * as metricQueries from '@/lib/dashboards/widgetData/metricQueries';
import * as chartQueries from '@/lib/dashboards/widgetData/chartQueries';
import * as tableQueries from '@/lib/dashboards/widgetData/tableQueries';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboards/[id]/widgets/[widgetId]/data
 * Fetch data for a specific widget
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; widgetId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view widget data');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User record not found');
      }
      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return internalError('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get widget and dashboard
    // Optimized: Simplified join - fetch dashboard separately if needed to avoid lateral join overhead
    const { data: widget, error: widgetError } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('id', params.widgetId)
      .eq('dashboard_id', params.id)
      .single();

    // Fetch dashboard separately if needed (simpler than lateral join)
    let dashboard = null;
    if (!widgetError && widget) {
      const { data: dashboardData } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', params.id)
        .single();
      dashboard = dashboardData;
    }

    if (widgetError || !widget) {
      return notFound('Widget not found');
    }

    if (!dashboard) {
      return notFound('Dashboard not found');
    }

    // Verify access
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have access to this widget');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have access to this widget');
      }
    } else if (dashboard.project_id) {
      // Check project membership
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', dashboard.project_id)
        .single();

      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', dashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have access to this widget');
      }
    }

    // Fetch widget data based on widget type and dataset configuration
    const dataset = widget.dataset || {};
    const dataSource = dataset.dataSource || dataset.source;
    const dataSources = dataset.dataSources; // Support multiple data sources
    let widgetData: any = null;

    try {
      switch (widget.widget_type) {
        case 'metric':
          if (!dataSource) {
            return badRequest('Metric widget requires a dataSource');
          }
          widgetData = await fetchMetricData(supabase, organizationId, dataSource, dataset, userData.id);
          break;
        case 'chart':
          if (!dataSource && (!dataSources || dataSources.length === 0)) {
            return badRequest('Chart widget requires at least one dataSource');
          }
          widgetData = await fetchChartData(supabase, organizationId, dataSource || dataSources, dataset);
          break;
        case 'table':
          widgetData = await fetchTableData(supabase, organizationId, dataSource, dataset);
          break;
        case 'ai_insight':
          // AI insights are generated on-demand, not fetched
          widgetData = {
            type: 'ai_insight',
            insight_type: dataset.insight_type || 'project_health',
            message: 'AI insights are generated on-demand. Use the AI insight generation API.',
          };
          break;
        case 'rich_text':
          // Rich text widgets don't need data fetching
          widgetData = {
            type: 'rich_text',
            content: dataset.content || '',
          };
          break;
        default:
          return badRequest(`Unknown widget type: ${widget.widget_type}`);
      }

      return NextResponse.json({ data: widgetData });
    } catch (error) {
      logger.error('[Dashboards API] Error fetching widget data:', error);
      return internalError('Failed to fetch widget data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    logger.error('[Dashboards API] Error in GET widget data:', error);
    return internalError('Failed to load widget data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Fetch metric widget data
 */
async function fetchMetricData(
  supabase: any,
  organizationId: string,
  dataSource: string,
  dataset: any,
  userId: string
) {
  const filters = dataset.filters || {};

  switch (dataSource) {
    case 'task_count':
      return await metricQueries.getTaskCount(supabase, organizationId, {
        projectId: filters.projectId,
        status: filters.status,
        assigneeId: filters.assigneeId || (filters.myTasks ? userId : undefined),
        dueDateRange: filters.dueDateRange,
      });
    case 'project_count':
      return await metricQueries.getProjectCount(supabase, organizationId, {
        status: filters.status,
      });
    case 'tasks_due_today':
      return await metricQueries.getTasksDueToday(supabase, organizationId, filters.assigneeId || (filters.myTasks ? userId : undefined));
    case 'overdue_tasks':
      return await metricQueries.getOverdueTasks(supabase, organizationId, filters.assigneeId || (filters.myTasks ? userId : undefined));
    case 'phase_completion':
      return await metricQueries.getPhaseCompletion(supabase, organizationId, filters.projectId);
    case 'ai_tokens_used':
      return await metricQueries.getAITokensUsed(supabase, organizationId, filters.dateRange);
    case 'export_count':
      return await metricQueries.getExportCount(supabase, organizationId, filters.dateRange);
    case 'user_count':
      return await metricQueries.getUserCount(supabase, organizationId);
    case 'opportunity_count':
      return await metricQueries.getOpportunityCount(supabase, organizationId, {
        status: filters.status,
      });
    case 'company_count':
      return await metricQueries.getCompanyCount(supabase, organizationId, {
        status: filters.status,
      });
    default:
      return { value: 0, label: 'Unknown metric' };
  }
}

/**
 * Fetch chart widget data
 * Supports single dataSource or multiple dataSources for comparison
 */
async function fetchChartData(
  supabase: any,
  organizationId: string,
  dataSource: string | string[] | undefined,
  dataset: any
) {
  const options = {
    projectId: dataset.filters?.projectId,
    dateRange: dataset.filters?.dateRange,
    groupBy: dataset.groupBy || 'day',
  };

  // Support multiple data sources for comparison
  const dataSources = dataset.dataSources || (dataSource ? [dataSource] : []);
  
  if (dataSources.length === 0) {
    return { data: [] };
  }

  // If multiple data sources, merge them into a single dataset
  if (dataSources.length > 1) {
    const allDataPromises = dataSources.map(async (ds: string) => {
      const result = await fetchSingleChartData(supabase, organizationId, ds, dataset, options);
      return { dataSource: ds, ...result };
    });

    const allData = await Promise.all(allDataPromises);
    
    // Create friendly labels for data sources
    const dataSourceLabels: Record<string, string> = {
      task_timeline: 'Tasks',
      phase_completion_timeline: 'Phases Completed',
      task_status_distribution: 'Task Status',
      task_priority_distribution: 'Task Priority',
      phase_status_distribution: 'Phase Status',
      ai_usage_timeline: 'AI Usage',
      export_timeline: 'Exports',
    };
    
    // Merge data by date/name key
    const mergedData: Record<string, any> = {};
    
    allData.forEach((seriesData) => {
      if (seriesData.data && Array.isArray(seriesData.data)) {
        seriesData.data.forEach((point: any) => {
          const key = point.name;
          if (!mergedData[key]) {
            mergedData[key] = { name: key };
          }
          // Use the dataSource as the key for the value
          // Sanitize the key to be a valid object property
          const sanitizedKey = seriesData.dataSource.replace(/[^a-zA-Z0-9]/g, '_');
          mergedData[key][sanitizedKey] = point.value;
        });
      }
    });

    // Convert to array and sort
    const mergedArray = Object.values(mergedData).sort((a: any, b: any) => 
      a.name.localeCompare(b.name)
    );

    return {
      data: mergedArray,
      series: dataSources.map((ds: string) => {
        const sanitizedKey = ds.replace(/[^a-zA-Z0-9]/g, '_');
        return {
          key: sanitizedKey,
          label: dataSourceLabels[ds] || allData.find(d => d.dataSource === ds)?.xAxis || ds,
        };
      }),
    };
  }

  // Single data source
  return await fetchSingleChartData(supabase, organizationId, dataSources[0], dataset, options);
}

/**
 * Fetch a single chart data source
 */
async function fetchSingleChartData(
  supabase: any,
  organizationId: string,
  dataSource: string,
  dataset: any,
  options: any
) {
  try {
    switch (dataSource) {
      case 'task_timeline':
        return await chartQueries.getTaskTimeline(supabase, organizationId, options);
      case 'phase_completion_timeline':
        return await chartQueries.getPhaseCompletionTimeline(supabase, organizationId, options);
      case 'task_status_distribution':
        return await chartQueries.getTaskStatusDistribution(supabase, organizationId, { projectId: options.projectId });
      case 'task_priority_distribution':
        return await chartQueries.getTaskPriorityDistribution(supabase, organizationId, { projectId: options.projectId });
      case 'phase_status_distribution':
        return await chartQueries.getPhaseStatusDistribution(supabase, organizationId, { projectId: options.projectId });
      case 'ai_usage_timeline':
        return await chartQueries.getAIUsageTimeline(supabase, organizationId, options);
      case 'export_timeline':
        return await chartQueries.getExportTimeline(supabase, organizationId, options);
      default:
        logger.warn(`[Chart Data] Unknown data source: ${dataSource}`);
        return { data: [] };
    }
  } catch (error) {
    logger.error(`[Chart Data] Error fetching ${dataSource}:`, error);
    return { data: [] };
  }
}

/**
 * Fetch table widget data
 */
async function fetchTableData(
  supabase: any,
  organizationId: string,
  dataSource: string,
  dataset: any
) {
  const options = {
    projectId: dataset.filters?.projectId,
    limit: dataset.limit || 50,
    status: dataset.filters?.status,
    assigneeId: dataset.filters?.assigneeId,
    orderBy: dataset.orderBy,
    orderDirection: dataset.orderDirection,
    actionTypes: dataset.filters?.actionTypes,
  };

  switch (dataSource) {
    case 'tasks':
      return await tableQueries.getTasksTable(supabase, organizationId, options);
    case 'projects':
      return await tableQueries.getProjectsTable(supabase, organizationId, options);
    case 'opportunities':
      return await tableQueries.getOpportunitiesTable(supabase, organizationId, options);
    case 'companies':
      return await tableQueries.getCompaniesTable(supabase, organizationId, options);
    case 'recent_activity':
      return await tableQueries.getRecentActivityTable(supabase, organizationId, options);
    default:
      return { columns: [], rows: [] };
  }
}

