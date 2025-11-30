import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { getWeeklyTasks, getMonthlyTasks, getForecastTasks } from '@/lib/reports/dataAggregator';
import {
  generateWeeklyReportContent,
  generateMonthlyReportContent,
  generateForecastReportContent,
} from '@/lib/reports/aiReportGenerator';
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
    let dateRange: string;

    if (reportType === 'weekly') {
      reportData = getWeeklyTasks(tasks);
      reportContent = await generateWeeklyReportContent(
        reportData,
        project.name,
        projectMembers,
        geminiApiKey
      );
      dateRange = `${format(reportData.lastWeek.start, 'MMM d')} - ${format(reportData.thisWeek.end, 'MMM d, yyyy')}`;
    } else if (reportType === 'monthly') {
      reportData = getMonthlyTasks(tasks);
      reportContent = await generateMonthlyReportContent(
        reportData,
        project.name,
        projectMembers,
        geminiApiKey
      );
      dateRange = format(reportData.month.start, 'MMMM yyyy');
    } else if (reportType === 'forecast') {
      reportData = getForecastTasks(tasks, forecastDays);
      reportContent = await generateForecastReportContent(
        reportData,
        project.name,
        projectMembers,
        geminiApiKey
      );
      dateRange = `${format(reportData.period.start, 'MMM d')} - ${format(reportData.period.end, 'MMM d, yyyy')}`;
    } else {
      return badRequest('Invalid report type');
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
