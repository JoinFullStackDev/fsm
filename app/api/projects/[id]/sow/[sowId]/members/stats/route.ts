import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// GET - Get task counts and workload for all SOW members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view SOW member stats');
    }

    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Verify project access
    const { data: project } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (!project) {
      return notFound('Project not found');
    }

    // Get SOW members
    const { data: members, error: membersError } = await adminClient
      .from('sow_project_members')
      .select(`
        project_member_id,
        project_member:project_members!sow_project_members_project_member_id_fkey(
          user_id
        )
      `)
      .eq('sow_id', params.sowId);

    if (membersError) {
      logger.error('[SOW Members Stats GET] Error loading members:', membersError);
      return internalError('Failed to load SOW members', { error: membersError.message });
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // Extract user IDs
    const memberUserIds = (members || [])
      .map((m: any) => m.project_member?.user_id)
      .filter(Boolean) as string[];

    if (memberUserIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // Get task counts and estimated hours per member (assignee_id is user_id)
    const { data: tasks, error: tasksError } = await adminClient
      .from('project_tasks')
      .select('assignee_id, status, estimated_hours, due_date')
      .eq('project_id', params.id)
      .in('assignee_id', memberUserIds)
      .neq('status', 'archived');

    // Get project member allocations
    // Include allocations that are active (NULL dates = ongoing, or dates that include today)
    const today = new Date().toISOString().split('T')[0];
    const { data: projectAllocations } = await adminClient
      .from('project_member_allocations')
      .select('user_id, allocated_hours_per_week')
      .eq('project_id', params.id)
      .in('user_id', memberUserIds)
      .or(`start_date.is.null,start_date.lte.${today},end_date.is.null,end_date.gte.${today}`);

    const allocationsMap = new Map<string, number>();
    projectAllocations?.forEach((alloc: any) => {
      allocationsMap.set(alloc.user_id, alloc.allocated_hours_per_week);
    });

    if (tasksError) {
      logger.error('[SOW Members Stats GET] Error loading tasks:', tasksError);
      // Continue without task counts
    }

    // Get workload summaries with error handling
    const workloadPromises = memberUserIds.map(userId =>
      Promise.resolve(adminClient.rpc('get_user_workload_summary', {
        p_user_id: userId,
        p_start_date: new Date().toISOString().split('T')[0],
        p_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })).then((result: any) => ({ userId, data: result.data, error: result.error }))
        .catch((error: any) => ({ userId, data: null, error }))
    );

    const workloadResults = await Promise.allSettled(workloadPromises);
    const workloadsMap = new Map<string, any>();

    workloadResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.data) {
        workloadsMap.set(memberUserIds[index], result.value.data);
      }
    });

    // Build stats for each member
    const stats = (members || []).map((member: any) => {
      const userId = member.project_member?.user_id;
      if (!userId) {
        return null;
      }

      const userTasks = tasks?.filter((t: any) => t.assignee_id === userId) || [];
      const taskCount = userTasks.length;
      const taskCountByStatus = {
        todo: userTasks.filter((t: any) => t.status === 'todo').length,
        in_progress: userTasks.filter((t: any) => t.status === 'in_progress').length,
        done: userTasks.filter((t: any) => t.status === 'done').length,
      };

      // Calculate total estimated hours
      const totalEstimatedHours = userTasks.reduce((sum: number, t: any) => {
        return sum + (parseFloat(t.estimated_hours) || 0);
      }, 0);

      // Get allocated hours for this project
      const allocatedHoursPerWeek = allocationsMap.get(userId) || 0;

      // Calculate average weeks until due dates
      const weeksUntilDue = userTasks.length > 0 && userTasks.some((t: any) => t.due_date)
        ? userTasks
            .filter((t: any) => t.due_date)
            .map((t: any) => {
              const daysUntilDue = Math.max(0, Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return daysUntilDue / 7;
            })
            .reduce((avg: number, weeks: number, idx: number, arr: number[]) => {
              return avg + (weeks / arr.length);
            }, 0) || 4
        : 4;

      // Check if over-allocated based on estimated hours vs allocated hours
      const totalAllocatedHours = allocatedHoursPerWeek * Math.max(weeksUntilDue, 1);
      const isOverAllocatedByHours = allocatedHoursPerWeek > 0 && totalEstimatedHours > totalAllocatedHours;

      const workloadSummary = workloadsMap.get(userId);
      // Combine workload-based and allocation-based overwork detection
      const isOverworked = workloadSummary?.is_over_allocated || isOverAllocatedByHours;

      return {
        project_member_id: member.project_member_id,
        user_id: userId,
        task_count: taskCount,
        task_count_by_status: taskCountByStatus,
        workload_summary: workloadSummary || null,
        is_overworked: isOverworked,
        total_estimated_hours: totalEstimatedHours,
        allocated_hours_per_week: allocatedHoursPerWeek,
        allocation_utilization: allocatedHoursPerWeek > 0 
          ? (totalEstimatedHours / totalAllocatedHours) * 100 
          : 0,
      };
    }).filter(Boolean);

    return NextResponse.json({ members: stats });
  } catch (error) {
    logger.error('[SOW Members Stats GET] Unexpected error:', error);
    return internalError('Failed to load SOW member stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

