import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboards/widgets/available
 * List all available widget types and their configurations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view available widgets');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return internalError('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return NextResponse.json({ widgets: [] });
    }

    // Define available widget types
    const availableWidgets = [
      {
        type: 'metric',
        name: 'Metric',
        description: 'Display a single metric value (count, total, percentage)',
        icon: 'Numbers',
        configurable: true,
        dataSources: [
          'task_count',
          'project_count',
          'phase_completion',
          'ai_tokens_used',
          'export_count',
          'user_count',
          'opportunity_count',
          'company_count',
        ],
      },
      {
        type: 'chart',
        name: 'Chart',
        description: 'Display data as a chart (line, bar, pie, area)',
        icon: 'BarChart',
        configurable: true,
        chartTypes: ['line', 'bar', 'pie', 'area'],
        dataSources: [
          'task_timeline',
          'phase_completion_timeline',
          'ai_usage_timeline',
          'export_timeline',
          'task_status_distribution',
          'task_priority_distribution',
          'phase_status_distribution',
        ],
      },
      {
        type: 'table',
        name: 'Table',
        description: 'Display data in a table format',
        icon: 'TableChart',
        configurable: true,
        dataSources: [
          'tasks',
          'projects',
          'opportunities',
          'companies',
          'contacts',
          'recent_activity',
        ],
      },
      {
        type: 'ai_insight',
        name: 'AI Insight',
        description: 'AI-generated insights and recommendations',
        icon: 'Lightbulb',
        configurable: true,
        dataSources: [
          'project_health',
          'risk_analysis',
          'bottleneck_detection',
          'task_prioritization',
          'timeline_prediction',
        ],
      },
      {
        type: 'rich_text',
        name: 'Rich Text',
        description: 'Display rich text content, notes, or goals',
        icon: 'TextFields',
        configurable: true,
        dataSources: [],
      },
    ];

    return NextResponse.json({ widgets: availableWidgets });
  } catch (error) {
    logger.error('[Dashboards API] Error in GET available widgets:', error);
    return internalError('Failed to load available widgets', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

