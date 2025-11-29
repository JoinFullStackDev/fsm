import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards, hasAIFeatures } from '@/lib/packageLimits';
import { generateAIResponse } from '@/lib/ai/geminiClient';
import { getGeminiConfig } from '@/lib/utils/geminiConfig';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/dashboard/summary
 * Generate AI summary for a dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to generate AI summaries');
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

    // Check module access
    const hasDashboardsAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasDashboardsAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    const hasAIAccess = await hasAIFeatures(supabase, organizationId);
    if (!hasAIAccess) {
      return forbidden('AI features are not enabled for your organization');
    }

    const body = await request.json();
    const { dashboard_id, context } = body;

    if (!dashboard_id) {
      return badRequest('dashboard_id is required');
    }

    // Get dashboard
    const { data: dashboard, error: dashboardError } = await supabase
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
        return forbidden('You do not have access to this dashboard');
      }
    }

    // Get Gemini config
    const geminiConfig = await getGeminiConfig(supabase);
    if (!geminiConfig || !geminiConfig.enabled || !geminiConfig.apiKey) {
      return badRequest('AI service is not configured');
    }

    // Build prompt for dashboard summary
    const widgets = (dashboard as any).widgets || [];
    const widgetSummary = widgets.map((w: any) => ({
      type: w.widget_type,
      dataset: w.dataset,
    }));

    const prompt = `Generate a comprehensive summary for a dashboard named "${dashboard.name}".

Dashboard Context:
- Dashboard Name: ${dashboard.name}
${dashboard.description ? `- Description: ${dashboard.description}` : ''}
- Widgets: ${JSON.stringify(widgetSummary, null, 2)}
${context ? `\nAdditional Context: ${context}` : ''}

Please provide:
1. An executive summary of what this dashboard shows
2. Key insights and trends
3. Notable patterns or anomalies
4. Actionable recommendations

Format the response as clear, concise markdown.`;

    // Generate AI response
    const aiResponse = await generateAIResponse(
      prompt,
      {
        context: `Dashboard: ${dashboard.name}`,
      },
      geminiConfig.apiKey,
      dashboard.name
    );

    const summary = typeof aiResponse === 'string' ? aiResponse : (aiResponse as any).text || '';

    return NextResponse.json({
      summary,
      dashboard_id: dashboard_id,
    });
  } catch (error) {
    logger.error('[AI Dashboard] Error generating summary:', error);
    return internalError('Failed to generate dashboard summary', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

