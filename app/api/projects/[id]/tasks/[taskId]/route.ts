import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { notifyTaskAssigned } from '@/lib/notifications';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// GET - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view tasks');
    }

    const { data: task, error } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .single();

    // Transform to flatten assignee
    const transformedTask = task ? {
      ...task,
      assignee: task.assignee || null,
    } : null;

    if (error || !transformedTask) {
      return notFound('Task');
    }

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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update tasks');
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
    } = body;

    // Get current task to check if assignee changed
    const { data: currentTask } = await supabase
      .from('project_tasks')
      .select('assignee_id, title')
      .eq('id', params.taskId)
      .single();

    const updateData: any = {};

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

    const { data: task, error } = await supabase
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

    // Check if assignee changed and create notification
    if (
      assignee_id !== undefined &&
      assignee_id !== currentTask?.assignee_id &&
      assignee_id &&
      assignee_id !== null
    ) {
      // Get project info
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', params.id)
        .single();

      // Get assigner info
      const { data: assigner } = await supabase
        .from('users')
        .select('id, name')
        .eq('auth_id', session.user.id)
        .single();

      if (project && assigner) {
        // Create notification asynchronously (don't wait for it)
        notifyTaskAssigned(
          assignee_id,
          params.taskId,
          task.title,
          params.id,
          project.name,
          assigner.id,
          assigner.name
        ).catch((err) => {
          logger.error('[Task Update] Error creating notification:', err);
        });
      }
    }

    // Transform to flatten assignee
    const transformedTask = {
      ...task,
      assignee: task.assignee || null,
    };

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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete tasks');
    }

    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', params.taskId)
      .eq('project_id', params.id);

    if (error) {
      logger.error('Error deleting task:', error);
      return internalError('Failed to delete task', { error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/projects/[id]/tasks/[taskId]:', error);
    return internalError('Failed to delete task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

