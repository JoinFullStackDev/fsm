import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

/**
 * GET - Fetch report data by ID
 * This endpoint allows viewing reports without authentication (for client sharing)
 * but checks if the report exists and hasn't expired
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();

    // Load report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(`
        *,
        project:projects(id, name)
      `)
      .eq('id', params.id)
      .single();

    // Load project members for team workload display
    let projectMembers: Array<{ id: string; name: string | null }> = [];
    if (report?.project_id) {
      const { data: membersData } = await supabase
        .from('project_members')
        .select('user_id, users(id, name)')
        .eq('project_id', report.project_id);
      
      projectMembers =
        (membersData as Array<{ user_id: string; users: { id: string; name: string | null } }> | null)?.map((m) => ({
          id: m.users.id,
          name: m.users.name,
        })) || [];
    }

    if (reportError || !report) {
      return notFound('Report not found');
    }

    // Check if report has expired
    if (report.expires_at && new Date(report.expires_at) < new Date()) {
      return notFound('This report has expired');
    }

    return NextResponse.json({
      id: report.id,
      projectName: report.project?.name || 'Project',
      reportType: report.report_type,
      format: report.format,
      dateRange: report.date_range,
      reportData: report.report_data,
      reportContent: report.report_content,
      createdAt: report.created_at,
      projectMembers,
    });
  } catch (error) {
    logger.error('Error fetching report:', error);
    return internalError('Failed to fetch report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

