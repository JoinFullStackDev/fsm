import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';

// GET - List all tasks for a project
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

    const { data: tasks, error } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .eq('project_id', params.id)
      .order('created_at', { ascending: false });

    // Transform the data to flatten assignee
    const transformedTasks = tasks?.map((task: any) => ({
      ...task,
      assignee: task.assignee || null,
    })) || [];

    if (error) {
      logger.error('Error loading tasks:', error);
      return internalError('Failed to load tasks', { error: error.message });
    }

    return NextResponse.json(transformedTasks);
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/tasks:', error);
    return internalError('Failed to load tasks', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create a new task
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create tasks');
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

    if (!title || !title.trim()) {
      return badRequest('Task title is required');
    }

    const { data: task, error } = await supabase
      .from('project_tasks')
      .insert({
        project_id: params.id,
        title,
        description: description || null,
        phase_number: phase_number || null,
        status: status || 'todo',
        priority: priority || 'medium',
        assignee_id: assignee_id || null,
        start_date: start_date || null,
        due_date: due_date || null,
        tags: tags || [],
        notes: notes || null,
        dependencies: dependencies || [],
        ai_generated: false,
        ai_analysis_id: null,
      })
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      logger.error('Error creating task:', error);
      return internalError('Failed to create task', { error: error.message });
    }

    if (!task) {
      return internalError('Task was not created');
    }

    // Transform to flatten assignee
    const transformedTask = {
      ...task,
      assignee: task.assignee || null,
    };

    return NextResponse.json(transformedTask, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/tasks:', error);
    return internalError('Failed to create task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

