import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/my-tasks
 * Get tasks assigned to the current user across all accessible projects
 * Uses admin client to bypass RLS recursion issues
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view your tasks');
    }

    // Get user's database ID using admin client to bypass RLS
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: dbUserError } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (dbUserError || !userData) {
      logger.error('[My Tasks API] User not found:', dbUserError);
      return unauthorized('User not found');
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // 'todo,in_progress' or specific status
    const dueDateFilter = searchParams.get('due_date_filter'); // 'next_2_weeks', 'overdue', etc.

    // Build query for tasks assigned to this user
    let query = adminClient
      .from('project_tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        start_date,
        phase_number,
        project_id,
        assignee_id,
        created_at,
        updated_at,
        project:projects!project_tasks_project_id_fkey(id, name, organization_id)
      `)
      .eq('assignee_id', userData.id);

    // Filter by status if provided
    if (status) {
      const statuses = status.split(',');
      query = query.in('status', statuses);
    }

    // Filter by due date
    if (dueDateFilter === 'next_2_weeks') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoWeeksFromNow = new Date(today);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      
      query = query
        .not('due_date', 'is', null)
        .gte('due_date', today.toISOString())
        .lte('due_date', twoWeeksFromNow.toISOString());
    } else if (dueDateFilter === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      query = query
        .not('due_date', 'is', null)
        .lt('due_date', today.toISOString())
        .neq('status', 'done')
        .neq('status', 'archived');
    }

    // Order by due date
    query = query.order('due_date', { ascending: true, nullsFirst: false });

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      logger.error('[My Tasks API] Error loading tasks:', tasksError);
      return internalError('Failed to load tasks', { error: tasksError.message });
    }

    // Filter tasks to only include those from user's organization
    const filteredTasks = (tasks || []).filter((task: any) => {
      return task.project?.organization_id === userData.organization_id;
    });

    return NextResponse.json({
      tasks: filteredTasks,
      count: filteredTasks.length,
    });
  } catch (error) {
    logger.error('[My Tasks API] Unexpected error:', error);
    return internalError('Failed to load tasks', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

