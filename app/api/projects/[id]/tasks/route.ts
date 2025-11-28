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
  const searchParams = request.nextUrl.searchParams;
  const includeSubtasks = searchParams.get('include_subtasks') === 'true';
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

    if (error) {
      logger.error('Error loading tasks:', error);
      return internalError('Failed to load tasks', { error: error.message });
    }

    // Transform the data to flatten assignee
    const transformedTasks = tasks?.map((task: any) => ({
      ...task,
      assignee: task.assignee || null,
    })) || [];

    // If includeSubtasks is true, group tasks by parent and nest subtasks
    if (includeSubtasks) {
      const parentTasks = transformedTasks.filter((task: any) => !task.parent_task_id);
      const subtasksByParent = new Map<string, any[]>();

      transformedTasks.forEach((task: any) => {
        if (task.parent_task_id) {
          if (!subtasksByParent.has(task.parent_task_id)) {
            subtasksByParent.set(task.parent_task_id, []);
          }
          subtasksByParent.get(task.parent_task_id)!.push(task);
        }
      });

      // Attach subtasks to parent tasks
      const tasksWithSubtasks = parentTasks.map((task: any) => ({
        ...task,
        subtasks: subtasksByParent.get(task.id) || [],
      }));

      return NextResponse.json(tasksWithSubtasks);
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

    // Verify project exists and user has access to it
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      if (projectError?.code === 'PGRST116') {
        return notFound('Project not found');
      }
      logger.error('[Task POST] Error checking project:', projectError);
      return internalError('Failed to verify project access', { error: projectError?.message });
    }

    // Verify user has access to this project (either owner or member)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Task POST] User not found:', userError);
      return unauthorized('User not found');
    }

    // Check if user is project owner or member
    const isOwner = project.owner_id === userData.id;
    const { data: memberData } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', userData.id)
      .single();

    if (!isOwner && !memberData) {
      return unauthorized('You do not have access to this project');
    }

    // Verify organization match (tasks inherit org through projects)
    if (project.organization_id && userData.organization_id !== project.organization_id) {
      return unauthorized('Project does not belong to your organization');
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

    if (!title || !title.trim()) {
      return badRequest('Task title is required');
    }

    // Validate parent_task_id if provided
    if (parent_task_id) {
      // Check that parent task exists and belongs to same project
      const { data: parentTask, error: parentError } = await supabase
        .from('project_tasks')
        .select('id, project_id, parent_task_id')
        .eq('id', parent_task_id)
        .eq('project_id', params.id)
        .single();

      if (parentError || !parentTask) {
        return badRequest('Parent task not found or does not belong to this project');
      }

      // Validate one-level nesting: parent task cannot already have a parent
      if (parentTask.parent_task_id) {
        return badRequest('Subtasks cannot have subtasks. Only one level of nesting is supported.');
      }
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
        parent_task_id: parent_task_id || null,
        ai_generated: false,
        ai_analysis_id: null,
      })
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      logger.error('[Task POST] Error creating task:', error);
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

