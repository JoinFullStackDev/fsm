import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { getWeeklyTasks, getMonthlyTasks, getForecastTasks } from '@/lib/reports/dataAggregator';
import {
  generateWeeklyReportContent,
  generateMonthlyReportContent,
  generateForecastReportContent,
} from '@/lib/reports/aiReportGenerator';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import { generatePDFReport } from '@/lib/reports/pdfGenerator';
import { format } from 'date-fns';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to generate reports');
    }

    const body = await request.json();
    const { reportType, format: reportFormat, forecastDays } = body;

    if (!reportType || !reportFormat) {
      return badRequest('reportType and format are required');
    }

    if (reportType === 'forecast' && !forecastDays) {
      return badRequest('forecastDays is required for forecast reports');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return internalError('Failed to load user data');
    }

    // Load project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return internalError('Project not found');
    }

    // Load tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .eq('project_id', params.id)
      .order('created_at', { ascending: false });

    if (tasksError) {
      logger.error('Error loading tasks:', tasksError);
      return internalError('Failed to load tasks');
    }

    const tasks = (tasksData || []).map((task: any) => ({
      ...task,
      assignee: task.assignee || null,
    }));

    // Load project members
    const { data: membersData, error: membersError } = await supabase
      .from('project_members')
      .select('user_id, users(id, name, email)')
      .eq('project_id', params.id);

    const projectMembers =
      membersData?.map((m: any) => ({
        id: m.users.id,
        name: m.users.name,
      })) || [];

    // Get Gemini API key (prioritizes environment variable - super admin's credentials)
    const { getGeminiApiKey } = await import('@/lib/utils/geminiConfig');
    const geminiApiKey = await getGeminiApiKey(supabase) || undefined;

    // Aggregate data based on report type
    let reportData: any;
    let reportContent: any;
    let reportMetadata: any = null;
    let dateRange: string;

    if (reportType === 'weekly') {
      reportData = getWeeklyTasks(tasks);
      const result = await generateWeeklyReportContent(
        reportData,
        project.name,
        projectMembers,
        geminiApiKey
      );
      reportContent = result.content;
      reportMetadata = result.metadata;
      dateRange = `${format(reportData.lastWeek.start, 'MMM d')} - ${format(reportData.thisWeek.end, 'MMM d, yyyy')}`;
    } else if (reportType === 'monthly') {
      reportData = getMonthlyTasks(tasks);
      const result = await generateMonthlyReportContent(
        reportData,
        project.name,
        projectMembers,
        geminiApiKey
      );
      reportContent = result.content;
      reportMetadata = result.metadata;
      dateRange = format(reportData.month.start, 'MMMM yyyy');
    } else if (reportType === 'forecast') {
      reportData = getForecastTasks(tasks, forecastDays);
      const result = await generateForecastReportContent(
        reportData,
        project.name,
        projectMembers,
        geminiApiKey
      );
      reportContent = result.content;
      reportMetadata = result.metadata;
      dateRange = `${format(reportData.period.start, 'MMM d')} - ${format(reportData.period.end, 'MMM d, yyyy')}`;
    } else {
      return badRequest('Invalid report type');
    }

    // Log AI usage (non-blocking)
    if (reportMetadata && userData?.id) {
      logAIUsage(
        supabase,
        userData.id,
        'report_generation',
        reportMetadata,
        'project',
        params.id
      ).catch((err) => {
        logger.error('[Reports API] Error logging AI usage:', err);
      });
    }

    // Generate report based on format
    if (reportFormat === 'pdf') {
      const pdfBlob = generatePDFReport({
        projectName: project.name,
        reportType,
        dateRange,
        content: reportContent,
        data: reportData,
        projectMembers,
      });

      // Convert blob to buffer for Next.js response
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${project.name}_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.pdf"`,
        },
      });
    } else if (reportFormat === 'slideshow') {
      // Save report to database and return report ID
      const { data: reportRecord, error: insertError } = await supabase
        .from('reports')
        .insert({
          project_id: params.id,
          user_id: userData.id,
          report_type: reportType,
          format: reportFormat,
          forecast_days: forecastDays || null,
          date_range: dateRange,
          report_data: reportData,
          report_content: reportContent,
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error('Error saving report:', insertError);
        return internalError('Failed to save report');
      }

      return NextResponse.json({
        reportId: reportRecord.id,
        url: `/reports/${reportRecord.id}`,
      });
    } else {
      return badRequest('Invalid format');
    }
  } catch (error) {
    logger.error('Error generating report:', error);
    return internalError('Failed to generate report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET - Fetch all reports for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view reports');
    }

    // Load reports for this project
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select(`
        id,
        report_type,
        format,
        forecast_days,
        date_range,
        created_at,
        expires_at,
        user:users!reports_user_id_fkey(id, name, email)
      `)
      .eq('project_id', params.id)
      .order('created_at', { ascending: false });

    if (reportsError) {
      logger.error('Error loading reports:', reportsError);
      return internalError('Failed to load reports');
    }

    return NextResponse.json({
      reports: reports || [],
    });
  } catch (error) {
    logger.error('Error fetching reports:', error);
    return internalError('Failed to fetch reports', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE - Delete a report
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to delete reports');
    }

    // Get report ID from query params
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return badRequest('reportId is required');
    }

    // Get user record
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Reports DELETE] User not found:', userError);
      return unauthorized('User record not found');
    }

    // Get report to check ownership and project access
    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .select('id, project_id, user_id')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      logger.error('[Reports DELETE] Report not found:', reportError);
      return notFound('Report not found');
    }

    // Verify project access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, owner_id, organization_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      logger.error('[Reports DELETE] Project not found:', projectError);
      return notFound('Project not found');
    }

    // Check permissions: user must be report owner, project owner, admin, or super admin
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const isReportOwner = report.user_id === userData.id;
    const isAdmin = userData.role === 'admin';

    if (!isSuperAdmin && !isProjectOwner && !isReportOwner && !isAdmin) {
      return forbidden('You do not have permission to delete this report');
    }

    // Delete the report
    const { error: deleteError } = await adminClient
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (deleteError) {
      logger.error('[Reports DELETE] Error deleting report:', deleteError);
      return internalError('Failed to delete report', { error: deleteError.message });
    }

    return NextResponse.json({ message: 'Report deleted successfully' });
  } catch (error) {
    logger.error('[Reports DELETE] Unexpected error:', error);
    return internalError('Failed to delete report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
