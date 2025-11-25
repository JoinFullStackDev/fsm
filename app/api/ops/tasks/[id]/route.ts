import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';
import type { OpsTask, TaskComment } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view tasks');
    }

    const { id } = params;

    // Get task with relations
    const { data: task, error: taskError } = await supabase
      .from('ops_tasks')
      .select(`
        *,
        contact:company_contacts(id, first_name, last_name, email),
        assigned_user:users!ops_tasks_assigned_to_fkey(id, name, email),
        company:companies(id, name)
      `)
      .eq('id', id)
      .single();

    if (taskError || !task) {
      if (taskError?.code === 'PGRST116') {
        return notFound('Task not found');
      }
      logger.error('Error loading task:', taskError);
      return internalError('Failed to load task', { error: taskError?.message });
    }

    return NextResponse.json(task);
  } catch (error) {
    logger.error('Error in GET /api/ops/tasks/[id]:', error);
    return internalError('Failed to load task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update tasks');
    }

    const { id } = params;
    const body = await request.json();
    const { title, description, notes, comments, contact_id, assigned_to, due_date } = body;

    // Get existing task to check company_id
    const { data: existingTask, error: existingError } = await supabase
      .from('ops_tasks')
      .select('company_id, title')
      .eq('id', id)
      .single();

    if (existingError || !existingTask) {
      if (existingError?.code === 'PGRST116') {
        return notFound('Task not found');
      }
      logger.error('Error checking task:', existingError);
      return internalError('Failed to check task', { error: existingError?.message });
    }

    // Validate
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return badRequest('Task title cannot be empty');
    }

    // Build update object
    const updateData: Partial<OpsTask> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (notes !== undefined) updateData.notes = notes;
    if (comments !== undefined) updateData.comments = comments;
    if (contact_id !== undefined) updateData.contact_id = contact_id || null;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to || null;
    if (due_date !== undefined) updateData.due_date = due_date || null;

    // Update task
    const { data: task, error: taskError } = await supabase
      .from('ops_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (taskError || !task) {
      logger.error('Error updating task:', taskError);
      return internalError('Failed to update task', { error: taskError?.message });
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: existingTask.company_id,
        related_entity_id: id,
        related_entity_type: 'task',
        event_type: 'task_updated',
        message: `Task "${task.title}" was updated`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
      // Don't fail the request if activity feed creation fails
    }

    return NextResponse.json(task);
  } catch (error) {
    logger.error('Error in PUT /api/ops/tasks/[id]:', error);
    return internalError('Failed to update task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete tasks');
    }

    const { id } = params;

    // Check if task exists
    const { data: task, error: checkError } = await supabase
      .from('ops_tasks')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !task) {
      if (checkError?.code === 'PGRST116') {
        return notFound('Task not found');
      }
      logger.error('Error checking task:', checkError);
      return internalError('Failed to check task', { error: checkError?.message });
    }

    // Delete task
    const { error: deleteError } = await supabase
      .from('ops_tasks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Error deleting task:', deleteError);
      return internalError('Failed to delete task', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/tasks/[id]:', error);
    return internalError('Failed to delete task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

