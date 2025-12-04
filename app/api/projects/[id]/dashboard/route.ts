import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view dashboard');
    }

    const projectId = params.id;
    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Dashboard API] User not found:', userError);
      return unauthorized('User record not found');
    }

    // Get project
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, owner_id, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      logger.error('[Dashboard API] Project not found:', projectError);
      return notFound('Project not found');
    }

    // Check access - all project members can view dashboard
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;

    let isProjectMember = false;
    if (!isSuperAdmin && !isProjectOwner) {
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .single();
      isProjectMember = !!projectMember;
    }

    if (!isSuperAdmin && !isProjectOwner && !isProjectMember && project.organization_id !== userData.organization_id) {
      return forbidden('You do not have access to this project');
    }

    // Get all tasks for the project
    const { data: tasks, error: tasksError } = await adminClient
      .from('project_tasks')
      .select(`
        id,
        status,
        priority,
        due_date,
        phase_number,
        assignee_id,
        created_at,
        updated_at
      `)
      .eq('project_id', projectId)
      .neq('status', 'archived');

    if (tasksError) {
      logger.error('[Dashboard API] Error loading tasks:', tasksError);
      return internalError('Failed to load tasks', { error: tasksError.message });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate metrics
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
    const incompleteTasks = tasks?.filter(t => t.status !== 'completed' && t.status !== 'archived').length || 0;
    const overdueTasks = tasks?.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length || 0;

    // Tasks by phase/section (incomplete, completed, overdue)
    const incompleteByPhase: Record<number, number> = {};
    const completedByPhase: Record<number, number> = {};
    const overdueByPhase: Record<number, number> = {};
    
    tasks?.forEach(task => {
      if (!task.phase_number) return;
      
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const isOverdue = dueDate && dueDate < today && task.status !== 'completed';
      
      if (task.status === 'completed') {
        completedByPhase[task.phase_number] = (completedByPhase[task.phase_number] || 0) + 1;
      } else if (task.status !== 'archived') {
        incompleteByPhase[task.phase_number] = (incompleteByPhase[task.phase_number] || 0) + 1;
      }
      
      if (isOverdue) {
        overdueByPhase[task.phase_number] = (overdueByPhase[task.phase_number] || 0) + 1;
      }
    });

    // Tasks by status
    const tasksByStatus: Record<string, number> = {};
    tasks?.forEach(task => {
      tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
    });

    // Tasks by priority
    const tasksByPriority: Record<string, number> = {};
    tasks?.forEach(task => {
      const priority = task.priority || 'none';
      tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;
    });

    // Tasks by assignee (upcoming, all, overdue)
    const upcomingByAssignee: Record<string, number> = {};
    const allByAssignee: Record<string, number> = {};
    const overdueByAssignee: Record<string, number> = {};
    
    tasks?.forEach(task => {
      if (!task.assignee_id) return;
      
      // All tasks by assignee (non-completed)
      if (task.status !== 'completed' && task.status !== 'archived') {
        allByAssignee[task.assignee_id] = (allByAssignee[task.assignee_id] || 0) + 1;
      }
      
      // Upcoming tasks by assignee
      if (task.due_date && task.status !== 'completed') {
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate >= today) {
          upcomingByAssignee[task.assignee_id] = (upcomingByAssignee[task.assignee_id] || 0) + 1;
        } else if (dueDate < today) {
          // Overdue tasks by assignee
          overdueByAssignee[task.assignee_id] = (overdueByAssignee[task.assignee_id] || 0) + 1;
        }
      }
    });

    // Get assignee names (for all assignees used in any chart)
    const allAssigneeIds = new Set([
      ...Object.keys(upcomingByAssignee),
      ...Object.keys(allByAssignee),
      ...Object.keys(overdueByAssignee),
    ]);
    const assigneeMap: Record<string, string> = {};
    if (allAssigneeIds.size > 0) {
      const { data: assignees } = await adminClient
        .from('users')
        .select('id, name, email')
        .in('id', Array.from(allAssigneeIds));
      
      assignees?.forEach(user => {
        assigneeMap[user.id] = user.name || user.email || 'Unknown';
      });
    }

    // Task completion over time (last 30 days)
    const completionOverTime: Array<{ date: string; completed: number; total: number }> = [];
    const dateMap: Record<string, { completed: number; total: number }> = {};
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = { completed: 0, total: 0 };
    }

    // Count tasks created/completed per day
    tasks?.forEach(task => {
      if (task.created_at) {
        const createdDate = new Date(task.created_at);
        createdDate.setHours(0, 0, 0, 0);
        const dateStr = createdDate.toISOString().split('T')[0];
        if (dateMap[dateStr]) {
          dateMap[dateStr].total++;
        }
      }
      // Use updated_at as completion date when status is completed
      if (task.status === 'completed' && task.updated_at) {
        const completedDate = new Date(task.updated_at);
        completedDate.setHours(0, 0, 0, 0);
        const dateStr = completedDate.toISOString().split('T')[0];
        if (dateMap[dateStr]) {
          dateMap[dateStr].completed++;
        }
      }
    });

    // Convert to array format
    Object.keys(dateMap).sort().forEach(date => {
      completionOverTime.push({
        date,
        completed: dateMap[date].completed,
        total: dateMap[date].total,
      });
    });

    // Get phase names
    const { data: phases } = await adminClient
      .from('project_phases')
      .select('phase_number, phase_name')
      .eq('project_id', projectId)
      .eq('is_active', true);

    const phaseMap: Record<number, string> = {};
    phases?.forEach(phase => {
      phaseMap[phase.phase_number] = phase.phase_name;
    });

    return NextResponse.json({
      metrics: {
        total: totalTasks,
        completed: completedTasks,
        incomplete: incompleteTasks,
        overdue: overdueTasks,
      },
      incompleteByPhase: Object.entries(incompleteByPhase).map(([phaseNum, count]) => ({
        phase_number: parseInt(phaseNum),
        phase_name: phaseMap[parseInt(phaseNum)] || `Phase ${phaseNum}`,
        count,
      })),
      completedByPhase: Object.entries(completedByPhase).map(([phaseNum, count]) => ({
        phase_number: parseInt(phaseNum),
        phase_name: phaseMap[parseInt(phaseNum)] || `Phase ${phaseNum}`,
        count,
      })),
      overdueByPhase: Object.entries(overdueByPhase).map(([phaseNum, count]) => ({
        phase_number: parseInt(phaseNum),
        phase_name: phaseMap[parseInt(phaseNum)] || `Phase ${phaseNum}`,
        count,
      })),
      tasksByStatus: Object.entries(tasksByStatus).map(([status, count]) => ({
        status,
        count,
      })),
      tasksByPriority: Object.entries(tasksByPriority).map(([priority, count]) => ({
        priority,
        count,
      })),
      upcomingByAssignee: Object.entries(upcomingByAssignee).map(([assigneeId, count]) => ({
        assignee_id: assigneeId,
        assignee_name: assigneeMap[assigneeId] || 'Unknown',
        count,
      })),
      allByAssignee: Object.entries(allByAssignee).map(([assigneeId, count]) => ({
        assignee_id: assigneeId,
        assignee_name: assigneeMap[assigneeId] || 'Unknown',
        count,
      })),
      overdueByAssignee: Object.entries(overdueByAssignee).map(([assigneeId, count]) => ({
        assignee_id: assigneeId,
        assignee_name: assigneeMap[assigneeId] || 'Unknown',
        count,
      })),
      completionOverTime,
    });
  } catch (error) {
    logger.error('[Dashboard API] Unexpected error:', error);
    return internalError('Failed to load dashboard data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

