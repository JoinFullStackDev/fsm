import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { notifyCommentCreated, notifyCommentMention } from '@/lib/notifications';
import type { TaskComment } from '@/types/project';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS for reading comments
    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get task to verify organization access
    const { data: task } = await adminClient
      .from('project_tasks')
      .select('id, project_id, project:projects!project_tasks_project_id_fkey(organization_id)')
      .eq('id', params.taskId)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify user belongs to the same organization as the project
    const projectOrgId = (task.project as any)?.organization_id;
    if (projectOrgId && userData.organization_id !== projectOrgId) {
      return NextResponse.json({ error: 'You do not have access to this task' }, { status: 403 });
    }

    // Get comments with user info
    const { data: comments, error } = await adminClient
      .from('task_comments')
      .select(`
        *,
        user:users!task_comments_user_id_fkey(id, name, email, avatar_url)
      `)
      .eq('task_id', params.taskId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS - comments should be available for all org members
    const adminClient = createAdminSupabaseClient();

    // Get user record with organization
    const { data: userData } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get task to verify organization access
    const { data: taskData } = await adminClient
      .from('project_tasks')
      .select('id, project_id, assignee_id, title, project:projects!project_tasks_project_id_fkey(organization_id, name)')
      .eq('id', params.taskId)
      .single();

    if (!taskData) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify user belongs to the same organization as the project
    const projectOrgId = (taskData.project as any)?.organization_id;
    if (projectOrgId && userData.organization_id !== projectOrgId) {
      return NextResponse.json({ error: 'You do not have access to comment on this task' }, { status: 403 });
    }

    const body = await request.json();
    const { content, mentioned_user_ids = [] } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Insert comment using admin client to bypass RLS
    const insertData = {
      task_id: params.taskId,
      user_id: userData.id,
      content: content.trim(),
      mentioned_user_ids: mentioned_user_ids || [],
    };

    const { data: comment, error } = await adminClient
      .from('task_comments')
      .insert(insertData)
      .select(`
        *,
        user:users!task_comments_user_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Use taskData we already fetched for notifications
    const projectData = taskData.project as unknown as { organization_id: string; name: string } | null;
    if (taskData && projectData) {
      // Get commenter name
      const commenterName = comment.user?.name || null;

      // Strip HTML tags from comment preview for notification
      const commentText = comment.content.replace(/<[^>]*>/g, '');

      // Notify task assignee if commenter is not the assignee
      if (taskData.assignee_id && taskData.assignee_id !== userData.id) {
        notifyCommentCreated(
          taskData.assignee_id,
          userData.id,
          comment.id,
          params.taskId,
          taskData.title,
          taskData.project_id,
          projectData.name,
          commenterName,
          commentText
        ).catch((err) => {
          // Error creating notification
        });
      }

      // Notify mentioned users
      if (mentioned_user_ids && Array.isArray(mentioned_user_ids) && mentioned_user_ids.length > 0) {
        // Use Promise.all to wait for all notifications to be created
        const notificationPromises = mentioned_user_ids
          .filter((mentionedUserId: string) => {
            // Don't notify if mentioned user is the commenter
            if (mentionedUserId === userData.id) {
              return false;
            }
            return true;
          })
          .map((mentionedUserId: string) => {
            return notifyCommentMention(
              mentionedUserId,
              comment.id,
              params.taskId,
              taskData.title,
              taskData.project_id,
              projectData.name,
              commenterName,
              commentText
            )
            .catch((err) => {
              throw err;
            });
          });

        // Wait for all notifications to be created (but don't block the response)
        Promise.all(notificationPromises).catch((err) => {
          // Error creating some mention notifications
        });
      }
    }

    return NextResponse.json({ comment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create comment' },
      { status: 500 }
    );
  }
}

