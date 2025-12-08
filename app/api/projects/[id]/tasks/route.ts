import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { notifyTaskAssigned } from '@/lib/notifications';
import { sendTaskAssignedEmail } from '@/lib/emailNotifications';
import type { ProjectTask } from '@/types/project';

// Types for task data
interface TaskUser {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  project_id: string;
  phase_id: string | null;
  assignee_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  assignee: TaskUser | null;
}

interface TaskWithSubtasks extends TaskRow {
  subtasks: TaskRow[];
}

// GET - List all tasks for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const searchParams = request.nextUrl.searchParams;
  const includeSubtasks = searchParams.get('include_subtasks') === 'true';
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view tasks');
    }

    // Use admin client to avoid RLS recursion when querying tasks and users
    const adminClient = createAdminSupabaseClient();
    const { data: tasks, error } = await adminClient
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
    const transformedTasks: TaskRow[] = (tasks || []).map((task) => ({
      ...(task as TaskRow),
      assignee: task.assignee || null,
    }));

    // If includeSubtasks is true, group tasks by parent and nest subtasks
    if (includeSubtasks) {
      const parentTasks = transformedTasks.filter((task) => !task.parent_task_id);
      const subtasksByParent = new Map<string, TaskRow[]>();

      transformedTasks.forEach((task: TaskRow) => {
        if (task.parent_task_id) {
          if (!subtasksByParent.has(task.parent_task_id)) {
            subtasksByParent.set(task.parent_task_id, []);
          }
          subtasksByParent.get(task.parent_task_id)!.push(task);
        }
      });

      // Attach subtasks to parent tasks
      const tasksWithSubtasks: TaskWithSubtasks[] = parentTasks.map((task) => ({
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
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
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (dbUserError || !userData) {
      logger.error('[Task POST] User not found:', dbUserError);
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

    // Send notifications if task is assigned
    if (task.assignee_id) {
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
        .eq('auth_id', user.id)
        .single();

      if (project && assigner) {
        const taskLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${params.id}?task=${task.id}`;

        // Send in-app notification
        notifyTaskAssigned(
          task.assignee_id,
          task.id,
          task.title,
          params.id,
          project.name,
          assigner.id,
          assigner.name
        ).catch((err) => {
          logger.error('[Task POST] Error creating notification:', err);
        });

        // Send email notification
        sendTaskAssignedEmail(
          task.assignee_id,
          task.title,
          project.name,
          assigner.name || 'Someone',
          taskLink
        ).catch((err) => {
          logger.error('[Task POST] Error sending email notification:', err);
        });
      }
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

