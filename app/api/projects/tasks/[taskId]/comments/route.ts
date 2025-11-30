import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
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

    // Get user record
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get comments with user info
    const { data: comments, error } = await supabase
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

    // Get user record
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content, mentioned_user_ids = [] } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Insert comment
    const insertData = {
      task_id: params.taskId,
      user_id: userData.id,
      content: content.trim(),
      mentioned_user_ids: mentioned_user_ids || [],
    };

    const { data: comment, error } = await supabase
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

    // Create notifications for comment
    // Get task and project info for notifications
    const { data: task } = await supabase
      .from('project_tasks')
      .select('assignee_id, title, project_id')
      .eq('id', params.taskId)
      .single();

    if (task) {
      // Get project name
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', task.project_id)
        .single();

      // Get commenter name
      const commenterName = comment.user?.name || null;

      // Strip HTML tags from comment preview for notification
      const commentText = comment.content.replace(/<[^>]*>/g, '');

      // Notify task assignee if commenter is not the assignee
      if (task.assignee_id && task.assignee_id !== userData.id && project) {
        notifyCommentCreated(
          task.assignee_id,
          userData.id,
          comment.id,
          params.taskId,
          task.title,
          task.project_id,
          project.name,
          commenterName,
          commentText
        ).catch((err) => {
          // Error creating notification
        });
      }

      // Notify mentioned users
      if (mentioned_user_ids && Array.isArray(mentioned_user_ids) && mentioned_user_ids.length > 0 && project) {
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
              task.title,
              task.project_id,
              project.name,
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

