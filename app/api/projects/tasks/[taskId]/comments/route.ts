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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
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
    console.error('[Task Comments] Error:', error);
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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content, mentioned_user_ids = [] } = body;

    console.log('[Comment API] Received request:', {
      taskId: params.taskId,
      contentLength: content?.length || 0,
      mentioned_user_ids,
      mentioned_user_ids_count: mentioned_user_ids?.length || 0,
    });

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

    console.log('[Comment API] Inserting comment:', {
      task_id: insertData.task_id,
      user_id: insertData.user_id,
      content_length: insertData.content.length,
      mentioned_user_ids: insertData.mentioned_user_ids,
    });

    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert(insertData)
      .select(`
        *,
        user:users!task_comments_user_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      console.error('[Comment API] Error inserting comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Comment API] Comment inserted successfully:', {
      comment_id: comment.id,
      mentioned_user_ids: comment.mentioned_user_ids,
    });

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
          console.error('[Comment] Error creating notification:', err);
        });
      }

      // Notify mentioned users
      console.log('[Comment] Checking mentions:', {
        mentioned_user_ids,
        mentioned_user_ids_type: typeof mentioned_user_ids,
        is_array: Array.isArray(mentioned_user_ids),
        length: mentioned_user_ids?.length || 0,
        has_project: !!project,
        project_name: project?.name,
      });

      if (mentioned_user_ids && Array.isArray(mentioned_user_ids) && mentioned_user_ids.length > 0 && project) {
        console.log('[Comment] Processing mentions:', { 
          mentioned_user_ids, 
          commenter_id: userData.id,
          project_name: project.name 
        });
        
        // Use Promise.all to wait for all notifications to be created
        const notificationPromises = mentioned_user_ids
          .filter((mentionedUserId: string) => {
            // Don't notify if mentioned user is the commenter
            if (mentionedUserId === userData.id) {
              console.log('[Comment] Skipping notification - mentioned user is the commenter');
              return false;
            }
            return true;
          })
          .map((mentionedUserId: string) => {
            console.log('[Comment] Creating mention notification for user:', mentionedUserId);
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
            .then((result) => {
              console.log('[Comment] Mention notification created:', result);
              return result;
            })
            .catch((err) => {
              console.error('[Comment] Error creating mention notification:', err);
              throw err;
            });
          });

        // Wait for all notifications to be created (but don't block the response)
        Promise.all(notificationPromises).catch((err) => {
          console.error('[Comment] Error creating some mention notifications:', err);
        });
      } else {
        console.log('[Comment] No mentions to process:', { 
          mentioned_user_ids, 
          is_array: Array.isArray(mentioned_user_ids),
          has_project: !!project,
          project_name: project?.name,
        });
      }
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('[Task Comments] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create comment' },
      { status: 500 }
    );
  }
}

