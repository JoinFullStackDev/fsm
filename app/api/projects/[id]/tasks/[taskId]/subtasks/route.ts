import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';

/**
 * GET /api/projects/[id]/tasks/[taskId]/subtasks
 * Get all subtasks for a parent task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view subtasks');
    }

    // Verify parent task exists and user has access
    const { data: parentTask, error: parentError } = await supabase
      .from('project_tasks')
      .select('id, project_id')
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .single();

    if (parentError || !parentTask) {
      return notFound('Parent task not found');
    }

    // Get all subtasks
    const { data: subtasks, error } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .eq('project_id', params.id)
      .eq('parent_task_id', params.taskId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[Subtasks GET] Error loading subtasks:', error);
      return internalError('Failed to load subtasks', { error: error.message });
    }

    // Transform to flatten assignee
    const transformedSubtasks = (subtasks || []).map((task: any) => ({
      ...task,
      assignee: task.assignee || null,
    }));

    return NextResponse.json(transformedSubtasks);
  } catch (error) {
    logger.error('[Subtasks GET] Error:', error);
    return internalError('Failed to load subtasks', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/projects/[id]/tasks/[taskId]/subtasks
 * Create a subtask for a parent task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create subtasks');
    }

    // Verify parent task exists and user has access
    const { data: parentTask, error: parentError } = await supabase
      .from('project_tasks')
      .select('id, project_id, parent_task_id, phase_number')
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .single();

    if (parentError || !parentTask) {
      return notFound('Parent task not found');
    }

    // Validate one-level nesting: parent task cannot already have a parent
    if (parentTask.parent_task_id) {
      return badRequest('Subtasks cannot have subtasks. Only one level of nesting is supported.');
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      assignee_id,
      start_date,
      due_date,
      tags,
      notes,
      phase_number, // Allow override, but default to parent's phase
      dependencies, // Allow override, but default to parent task
    } = body;

    if (!title || !title.trim()) {
      return badRequest('Task title is required');
    }

    // Auto-set phase from parent if not provided
    const subtaskPhaseNumber = phase_number !== undefined ? phase_number : parentTask.phase_number;
    
    // Auto-set dependency on parent task if not provided
    const subtaskDependencies = dependencies !== undefined 
      ? dependencies 
      : (parentTask.id ? [parentTask.id] : []);

    // Create subtask
    const { data: subtask, error } = await supabase
      .from('project_tasks')
      .insert({
        project_id: params.id,
        parent_task_id: params.taskId,
        title,
        description: description || null,
        phase_number: subtaskPhaseNumber,
        status: status || 'todo',
        priority: priority || 'medium',
        assignee_id: assignee_id || null,
        start_date: start_date || null,
        due_date: due_date || null,
        tags: tags || [],
        notes: notes || null,
        dependencies: subtaskDependencies,
        ai_generated: false,
        ai_analysis_id: null,
      })
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      logger.error('[Subtasks POST] Error creating subtask:', error);
      return internalError('Failed to create subtask', { error: error.message });
    }

    if (!subtask) {
      return internalError('Subtask was not created');
    }

    // Transform to flatten assignee
    const transformedSubtask = {
      ...subtask,
      assignee: subtask.assignee || null,
    };

    return NextResponse.json(transformedSubtask, { status: 201 });
  } catch (error) {
    logger.error('[Subtasks POST] Error:', error);
    return internalError('Failed to create subtask', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

