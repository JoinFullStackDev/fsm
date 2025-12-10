import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { notifyTaskAssigned } from '@/lib/notifications';
import { sendTaskAssignedEmail, sendTaskUpdatedEmail } from '@/lib/emailNotifications';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { cacheDel, CACHE_KEYS } from '@/lib/cache/unifiedCache';
import { emitEntityEvent } from '@/lib/workflows/eventBus';
import logger from '@/lib/utils/logger';

// Type for task update data
interface TaskUpdateData {
  title?: string;
  description?: string | null;
  phase_number?: number | null;
  status?: string;
  priority?: string;
  assignee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  tags?: string[];
  notes?: string | null;
  dependencies?: string[];
  parent_task_id?: string | null;
}

// GET - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view tasks');
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminSupabaseClient();

    // Get user's organization
    const { data: userData } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Get task with project info to verify org access
    const { data: task, error } = await adminClient
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url),
        project:projects!project_tasks_project_id_fkey(organization_id)
      `)
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .single();

    if (error || !task) {
      return notFound('Task');
    }

    // Verify user belongs to same organization
    const projectOrgId = (task.project as any)?.organization_id;
    if (projectOrgId && userData.organization_id !== projectOrgId) {
      return forbidden('You do not have access to this task');
    }

    // Transform to flatten assignee and remove project relation
    const { project: _project, ...taskWithoutProject } = task;
    const transformedTask = {
      ...taskWithoutProject,
      assignee: task.assignee || null,
    };

    return NextResponse.json(transformedTask);
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/tasks/[taskId]:', error);
    return internalError('Failed to load task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// PUT - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update tasks');
    }

    // Use admin client to bypass RLS - all org members can update tasks
    const adminClient = createAdminSupabaseClient();

    // Get user's organization
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    const body = await request.json();
    const {
      title,
      description,
      phase_number,
      status,
      priority,
      assignee_id,
      start_date,
      due_date,
      tags,
      notes,
      dependencies,
      parent_task_id,
    } = body;

    // Get current task to check if assignee changed, validate parent_task_id, and verify org access
    const { data: currentTask } = await adminClient
      .from('project_tasks')
      .select('assignee_id, title, project_id, parent_task_id, project:projects!project_tasks_project_id_fkey(organization_id, name)')
      .eq('id', params.taskId)
      .single();

    if (!currentTask) {
      return notFound('Task');
    }

    // Verify user belongs to same organization as the project
    const projectOrgId = (currentTask.project as any)?.organization_id;
    if (projectOrgId && userData.organization_id !== projectOrgId) {
      return forbidden('You do not have access to update this task');
    }

    // Validate parent_task_id if being updated
    if (parent_task_id !== undefined && parent_task_id !== null) {
      // Prevent self-reference
      if (parent_task_id === params.taskId) {
        return badRequest('Task cannot be its own parent');
      }

      // Check that parent task exists and belongs to same project
      const { data: parentTask, error: parentError } = await adminClient
        .from('project_tasks')
        .select('id, project_id, parent_task_id')
        .eq('id', parent_task_id)
        .eq('project_id', currentTask?.project_id)
        .single();

      if (parentError || !parentTask) {
        return badRequest('Parent task not found or does not belong to this project');
      }

      // Validate one-level nesting: parent task cannot already have a parent
      if (parentTask.parent_task_id) {
        return badRequest('Subtasks cannot have subtasks. Only one level of nesting is supported.');
      }
    }

    const updateData: TaskUpdateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (phase_number !== undefined) updateData.phase_number = phase_number;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignee_id !== undefined) updateData.assignee_id = assignee_id;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    if (dependencies !== undefined) updateData.dependencies = dependencies;
    if (parent_task_id !== undefined) updateData.parent_task_id = parent_task_id;

    const { data: task, error } = await adminClient
      .from('project_tasks')
      .update(updateData)
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      logger.error('Error updating task:', error);
      return internalError('Failed to update task', { error: error.message });
    }

    if (!task) {
      return notFound('Task');
    }

    // Invalidate tasks cache after update
    try {
      await cacheDel(CACHE_KEYS.projectTasks(params.id));
    } catch (cacheError) {
      logger.warn('[Task PUT] Failed to invalidate cache:', cacheError);
    }

    // Get project name from current task for notifications
    const projectName = (currentTask.project as any)?.name;

    // Check if assignee changed and create notification
    if (
      assignee_id !== undefined &&
      assignee_id !== currentTask?.assignee_id &&
      assignee_id &&
      assignee_id !== null
    ) {
      if (projectName && userData) {
        const taskLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${params.id}?task=${params.taskId}`;

        // Create notification asynchronously (don't wait for it)
        notifyTaskAssigned(
          assignee_id,
          params.taskId,
          task.title,
          params.id,
          projectName,
          userData.id,
          userData.name
        ).catch((err) => {
          logger.error('[Task Update] Error creating notification:', err);
        });

        // Send email notification
        sendTaskAssignedEmail(
          assignee_id,
          task.title,
          projectName,
          userData.name || 'Someone',
          taskLink
        ).catch((err) => {
          logger.error('[Task Update] Error sending email notification:', err);
        });
      }
    }

    // Send email notification for other updates (status, priority changes) if assignee exists
    if (task.assignee_id && (status !== undefined || priority !== undefined) && projectName) {
      const taskLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${params.id}?task=${params.taskId}`;
      const updateDetails: string[] = [];
      if (status !== undefined) updateDetails.push(`Status changed to ${status}`);
      if (priority !== undefined) updateDetails.push(`Priority changed to ${priority}`);

      if (updateDetails.length > 0) {
        sendTaskUpdatedEmail(
          task.assignee_id,
          task.title,
          projectName,
          updateDetails.join(', '),
          taskLink
        ).catch((err) => {
          logger.error('[Task Update] Error sending task updated email:', err);
        });
      }
    }

    // Transform to flatten assignee
    const transformedTask = {
      ...task,
      assignee: task.assignee || null,
    };

    // Emit workflow event for task update (non-blocking)
    if (projectOrgId) {
      emitEntityEvent(
        'task_updated',
        'task',
        params.taskId,
        { ...transformedTask as unknown as Record<string, unknown>, status_changed_to: status },
        projectOrgId,
        userData?.id
      ).catch((err) => {
        logger.warn('[Task PUT] Failed to emit workflow event:', err);
      });
    }

    return NextResponse.json(transformedTask);
  } catch (error) {
    logger.error('Error in PUT /api/projects/[id]/tasks/[taskId]:', error);
    return internalError('Failed to update task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// DELETE - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to delete tasks');
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminSupabaseClient();

    // Get user's organization
    const { data: userData } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Get task with project info to verify org access
    const { data: task } = await adminClient
      .from('project_tasks')
      .select('id, project:projects!project_tasks_project_id_fkey(organization_id)')
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .single();

    if (!task) {
      return notFound('Task');
    }

    // Verify user belongs to same organization
    const projectOrgId = (task.project as any)?.organization_id;
    if (projectOrgId && userData.organization_id !== projectOrgId) {
      return forbidden('You do not have access to delete this task');
    }

    const { error } = await adminClient
      .from('project_tasks')
      .delete()
      .eq('id', params.taskId)
      .eq('project_id', params.id);

    if (error) {
      logger.error('Error deleting task:', error);
      return internalError('Failed to delete task', { error: error.message });
    }

    // Invalidate tasks cache after deletion
    try {
      await cacheDel(CACHE_KEYS.projectTasks(params.id));
    } catch (cacheError) {
      logger.warn('[Task DELETE] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/projects/[id]/tasks/[taskId]:', error);
    return internalError('Failed to delete task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

