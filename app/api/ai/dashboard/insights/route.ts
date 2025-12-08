import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards, hasAIFeatures } from '@/lib/packageLimits';
import { generateAIResponse, AIResponseWithMetadata } from '@/lib/ai/geminiClient';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import { getGeminiConfig } from '@/lib/utils/geminiConfig';
import * as metricQueries from '@/lib/dashboards/widgetData/metricQueries';
import * as chartQueries from '@/lib/dashboards/widgetData/chartQueries';
import * as tableQueries from '@/lib/dashboards/widgetData/tableQueries';
import logger from '@/lib/utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  DashboardRow,
  DashboardWidgetWithDataset,
  WidgetDataset,
  MetricWidgetData,
  ChartWidgetData,
  TableWidgetData,
  ChartDataPoint,
  ChartQueryOptions,
} from '@/types/database';

// Types for dashboard with widgets
interface DashboardWithWidgets extends DashboardRow {
  widgets: DashboardWidgetWithDataset[];
}

// Type for widget data fetch result
interface WidgetDataFetchResult {
  widget_id: string;
  widget_type: string;
  title: string;
  data_source?: string | string[];
  data?: MetricWidgetData | ChartWidgetData | TableWidgetData | null;
  error?: string;
}

// Type for chart data with series
interface ChartDataWithSeries extends ChartWidgetData {
  dataSource?: string;
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/dashboard/insights
 * Generate AI insights for a dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to generate AI insights');
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
      return badRequest('User is not assigned to an organization');
    }

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Check module access
    const hasDashboardsAccess = await hasCustomDashboards(adminClient, organizationId);
    if (!hasDashboardsAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    const hasAIAccess = await hasAIFeatures(adminClient, organizationId);
    if (!hasAIAccess) {
      return forbidden('AI features are not enabled for your organization');
    }

    const body = await request.json();
    const { dashboard_id, insight_type } = body;

    if (!dashboard_id) {
      return badRequest('dashboard_id is required');
    }

    // Get dashboard using admin client
    const { data: dashboard, error: dashboardError } = await adminClient
      .from('dashboards')
      .select('*, widgets:dashboard_widgets(*)')
      .eq('id', dashboard_id)
      .single();

    if (dashboardError || !dashboard) {
      return notFound('Dashboard not found');
    }

    // Verify access
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.project_id) {
      const { data: project } = await adminClient
        .from('projects')
        .select('owner_id')
        .eq('id', dashboard.project_id)
        .single();

      const { data: member } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', dashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have access to this dashboard');
      }
    }

    // Get Gemini config using admin client
    const geminiConfig = await getGeminiConfig(adminClient);
    if (!geminiConfig || !geminiConfig.enabled || !geminiConfig.apiKey) {
      return badRequest('AI service is not configured');
    }

    // Build prompt based on insight type
    const dashboardWithWidgets = dashboard as DashboardWithWidgets;
    const widgets: DashboardWidgetWithDataset[] = dashboardWithWidgets.widgets || [];
    
    // Fetch actual data for each widget (excluding AI insight widgets themselves)
    const widgetDataPromises = widgets
      .filter((w: DashboardWidgetWithDataset) => w.widget_type !== 'ai_insight' && w.widget_type !== 'rich_text')
      .map(async (widget: DashboardWidgetWithDataset): Promise<WidgetDataFetchResult> => {
        try {
          const dataset: WidgetDataset = widget.dataset || {};
          const dataSource = dataset.dataSource || dataset.source;
          const dataSources = dataset.dataSources;
          
          let widgetData: MetricWidgetData | ChartWidgetData | TableWidgetData | null = null;
          
          switch (widget.widget_type) {
            case 'metric':
              if (dataSource) {
                widgetData = await fetchMetricData(adminClient, organizationId, dataSource, dataset, userData.id);
              }
              break;
              
            case 'chart':
              if (dataSource || (dataSources && dataSources.length > 0)) {
                const options: ChartQueryOptions = {
                  projectId: dataset.filters?.projectId,
                  dateRange: typeof dataset.filters?.dateRange === 'object' ? dataset.filters.dateRange : undefined,
                  groupBy: (dataset.groupBy as 'day' | 'week' | 'month') || 'day',
                };
                widgetData = await fetchChartData(adminClient, organizationId, dataSource || dataSources, dataset, options);
              }
              break;
              
            case 'table':
              if (dataSource) {
                widgetData = await fetchTableData(adminClient, organizationId, dataSource, dataset);
              }
              break;
          }
          
          return {
            widget_id: widget.id,
            widget_type: widget.widget_type,
            title: widget.settings?.title || `${widget.widget_type} widget`,
            data_source: dataSource || dataSources || 'N/A',
            data: widgetData,
          };
        } catch (err) {
          logger.error(`[AI Insights] Error fetching data for widget ${widget.id}:`, err);
          return {
            widget_id: widget.id,
            widget_type: widget.widget_type,
            title: widget.settings?.title || `${widget.widget_type} widget`,
            error: 'Failed to fetch data',
          };
        }
      });
    
    const widgetDataResults: WidgetDataFetchResult[] = await Promise.all(widgetDataPromises);
    
    // Format widget data for the prompt
    const widgetDataSummary = widgetDataResults.map((w: WidgetDataFetchResult) => {
      if (w.error) {
        return `- ${w.title} (${w.widget_type}): ${w.error}`;
      }
      
      let dataSummary = '';
      if (w.widget_type === 'metric' && w.data) {
        const metricData = w.data as MetricWidgetData;
        dataSummary = `Value: ${metricData.value ?? 'N/A'}${metricData.label ? ` (${metricData.label})` : ''}${metricData.change ? `, Change: ${metricData.change}%` : ''}`;
      } else if (w.widget_type === 'chart' && w.data) {
        const chartData = w.data as ChartWidgetData;
        const dataPoints: ChartDataPoint[] = chartData.data || [];
        const series = chartData.series || [];
        if (dataPoints.length > 0) {
          const recentPoints = dataPoints.slice(-5); // Last 5 data points
          dataSummary = `Data points: ${dataPoints.length} total. Recent values: ${JSON.stringify(recentPoints)}`;
          if (series.length > 0) {
            dataSummary += ` Series: ${series.map((s) => s.label).join(', ')}`;
          }
        } else {
          dataSummary = 'No data available';
        }
      } else if (w.widget_type === 'table' && w.data) {
        const tableData = w.data as TableWidgetData;
        const rows = tableData.rows || [];
        const columns = tableData.columns || [];
        dataSummary = `Table with ${columns.length} columns and ${rows.length} rows. Columns: ${columns.join(', ')}`;
        if (rows.length > 0 && rows.length <= 5) {
          dataSummary += ` Sample rows: ${JSON.stringify(rows)}`;
        } else if (rows.length > 5) {
          dataSummary += ` First 3 rows: ${JSON.stringify(rows.slice(0, 3))}`;
        }
      }
      
      return `- ${w.title} (${w.widget_type}, source: ${w.data_source}): ${dataSummary}`;
    }).join('\n');

    const insightTypes: Record<string, string> = {
      project_health: 'Analyze the overall health of projects shown in this dashboard. Identify risks, blockers, and areas of concern based on the actual data values.',
      risk_analysis: 'Identify potential risks and issues based on the dashboard data. Prioritize by severity and impact using the actual metrics and trends shown.',
      bottleneck_detection: 'Detect bottlenecks and areas where work is getting stuck. Suggest ways to unblock progress based on the actual task, phase, and project data.',
      task_prioritization: 'Analyze task distribution and suggest prioritization recommendations based on urgency and importance using the actual task metrics and status data.',
      timeline_prediction: 'Based on current progress and trends shown in the charts and metrics, predict likely completion timelines and identify potential delays.',
    };

    const insightPrompt = insightTypes[insight_type || 'project_health'] || insightTypes.project_health;

    const prompt = `Generate AI insights for a dashboard named "${dashboard.name}".

Dashboard Context:
- Dashboard Name: ${dashboard.name}
${dashboard.description ? `- Description: ${dashboard.description}` : ''}

Actual Dashboard Data:
${widgetDataSummary || 'No data widgets found in dashboard.'}

Insight Type: ${insight_type || 'project_health'}

${insightPrompt}

IMPORTANT: Base your analysis on the ACTUAL DATA VALUES shown above. Reference specific numbers, trends, and patterns from the widget data. Do not provide generic insights - be specific about what the data reveals.

Format the response as clear, actionable markdown with:
1. Key findings (bullet points with specific data references)
2. Analysis and context (explain what the data means)
3. Recommendations (actionable steps based on the data)
4. Next steps (prioritized actions)`;

    // Generate AI response with metadata tracking
    const aiResponse = await generateAIResponse(
      prompt,
      {
        context: `Dashboard: ${dashboard.name}, Insight Type: ${insight_type || 'project_health'}`,
      },
      geminiConfig.apiKey,
      dashboard.name,
      true, // returnMetadata
      'gemini-2.5-flash' // Use Flash for complex dashboard insights
    );

    // Extract insights and metadata
    let insights: string;
    let metadata: AIResponseWithMetadata['metadata'] | null = null;
    
    if (typeof aiResponse === 'object' && aiResponse !== null && 'metadata' in aiResponse) {
      const typedResponse = aiResponse as AIResponseWithMetadata;
      insights = typedResponse.text || '';
      metadata = typedResponse.metadata;
    } else {
      insights = typeof aiResponse === 'string' ? aiResponse : '';
    }

    // Log AI usage (non-blocking)
    if (metadata && userData?.id) {
      logAIUsage(
        adminClient,
        userData.id,
        'dashboard_insights',
        metadata,
        'dashboard',
        dashboard_id
      ).catch((err) => {
        logger.error('[AI Dashboard] Error logging AI usage:', err);
      });
    }

    return NextResponse.json({
      insights,
      dashboard_id: dashboard_id,
      insight_type: insight_type || 'project_health',
    });
  } catch (error) {
    logger.error('[AI Dashboard] Error generating insights:', error);
    return internalError('Failed to generate dashboard insights', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Fetch metric widget data for AI insights
 */
async function fetchMetricData(
  supabase: SupabaseClient,
  organizationId: string,
  dataSource: string,
  dataset: WidgetDataset,
  userId: string
): Promise<MetricWidgetData> {
  const filters = dataset.filters || {};
  
  // Normalize status to string array if needed
  const status = filters.status;
  const statusArray: string[] | undefined = status 
    ? (Array.isArray(status) ? status : [status]) 
    : undefined;

  switch (dataSource) {
    case 'task_count':
      return await metricQueries.getTaskCount(supabase, organizationId, {
        projectId: filters.projectId,
        status: statusArray,
        assigneeId: filters.assigneeId || (filters.myTasks ? userId : undefined),
        dueDateRange: filters.dueDateRange,
      });
    case 'project_count':
      return await metricQueries.getProjectCount(supabase, organizationId, {
        status: statusArray,
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
        status: statusArray,
      });
    case 'company_count':
      return await metricQueries.getCompanyCount(supabase, organizationId, {
        status: statusArray,
      });
    default:
      return { value: 0, label: 'Unknown metric' };
  }
}

/**
 * Fetch chart widget data for AI insights
 */
async function fetchChartData(
  supabase: SupabaseClient,
  organizationId: string,
  dataSource: string | string[] | undefined,
  dataset: WidgetDataset,
  options: ChartQueryOptions
): Promise<ChartWidgetData> {
  // Support multiple data sources for comparison
  const dataSources: string[] = dataset.dataSources || (dataSource ? (Array.isArray(dataSource) ? dataSource : [dataSource]) : []);
  
  if (dataSources.length === 0) {
    return { data: [] };
  }

  // If multiple data sources, merge them into a single dataset
  if (dataSources.length > 1) {
    const allDataPromises = dataSources.map(async (ds: string): Promise<ChartDataWithSeries> => {
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
    const mergedData: Record<string, ChartDataPoint> = {};
    
    allData.forEach((seriesData: ChartDataWithSeries) => {
      if (seriesData.data && Array.isArray(seriesData.data)) {
        seriesData.data.forEach((point: ChartDataPoint) => {
          const key = point.name;
          if (!mergedData[key]) {
            mergedData[key] = { name: key, value: 0 };
          }
          const sanitizedKey = seriesData.dataSource?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
          mergedData[key][sanitizedKey] = point.value;
        });
      }
    });

    const mergedArray = Object.values(mergedData).sort((a: ChartDataPoint, b: ChartDataPoint) => 
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
  supabase: SupabaseClient,
  organizationId: string,
  dataSource: string,
  dataset: WidgetDataset,
  options: ChartQueryOptions
): Promise<ChartWidgetData> {
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
        logger.warn(`[AI Insights] Unknown chart data source: ${dataSource}`);
        return { data: [] };
    }
  } catch (error) {
    logger.error(`[AI Insights] Error fetching chart data ${dataSource}:`, error);
    return { data: [] };
  }
}

/**
 * Fetch table widget data for AI insights
 */
async function fetchTableData(
  supabase: SupabaseClient,
  organizationId: string,
  dataSource: string,
  dataset: WidgetDataset
): Promise<TableWidgetData> {
  // Normalize status to string array if needed
  const status = dataset.filters?.status;
  const statusArray: string[] | undefined = status 
    ? (Array.isArray(status) ? status : [status]) 
    : undefined;
  
  const options = {
    projectId: dataset.filters?.projectId,
    limit: dataset.limit || 50,
    status: statusArray,
    assigneeId: dataset.filters?.assigneeId,
    orderBy: dataset.orderBy,
    orderDirection: dataset.orderDirection as 'asc' | 'desc' | undefined,
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

