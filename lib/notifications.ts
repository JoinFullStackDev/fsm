import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import type { NotificationType, NotificationMetadata } from '@/types/project';

/**
 * Create a notification for a user
 * Uses admin client to bypass RLS and ensure notifications can be created for any user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata: NotificationMetadata = {}
): Promise<{ id: string } | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = createAdminSupabaseClient();

    // Check user preferences for in-app notifications
    const { data: user } = await adminClient
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    // Respect user preferences - if inApp notifications are disabled, don't create
    if (user?.preferences?.notifications?.inApp === false) {
      console.log('[Notifications] Skipping notification - user has in-app notifications disabled:', userId);
      return null;
    }

    console.log('[Notifications] Attempting to create notification:', {
      userId,
      type,
      title,
      message_preview: message.substring(0, 50),
    });

    // Use admin client to bypass RLS and ensure notification is created
    const { data: notification, error } = await adminClient
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Notifications] Error creating notification:', {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        userId,
        type,
        title,
        message: message.substring(0, 50),
      });
      return null;
    }

    console.log('[Notifications] Notification created successfully:', {
      id: notification?.id,
      userId,
      type,
    });

    return notification;
  } catch (error) {
    console.error('[Notifications] Error creating notification:', error);
    return null;
  }
}

/**
 * Notify user when a task is assigned to them
 */
export async function notifyTaskAssigned(
  assigneeId: string,
  taskId: string,
  taskTitle: string,
  projectId: string,
  projectName: string,
  assignerId: string,
  assignerName: string | null
): Promise<void> {
  await createNotification(
    assigneeId,
    'task_assigned',
    'New Task Assigned',
    `${assignerName || 'Someone'} assigned you the task "${taskTitle}" in ${projectName}`,
    {
      task_id: taskId,
      project_id: projectId,
      task_title: taskTitle,
      project_name: projectName,
      assigner_id: assignerId,
      assigner_name: assignerName || 'Unknown',
    }
  );
}

/**
 * Notify task assignee when a comment is created (if commenter is not the assignee)
 */
export async function notifyCommentCreated(
  assigneeId: string,
  commenterId: string,
  commentId: string,
  taskId: string,
  taskTitle: string,
  projectId: string,
  projectName: string,
  commenterName: string | null,
  commentPreview: string
): Promise<void> {
  // Don't notify if commenter is the assignee
  if (assigneeId === commenterId) {
    return;
  }

  // Truncate comment preview
  const preview = commentPreview.length > 100 
    ? commentPreview.substring(0, 100) + '...' 
    : commentPreview;

  await createNotification(
    assigneeId,
    'comment_created',
    'New Comment on Your Task',
    `${commenterName || 'Someone'} commented on "${taskTitle}" in ${projectName}: "${preview}"`,
    {
      comment_id: commentId,
      task_id: taskId,
      project_id: projectId,
      task_title: taskTitle,
      project_name: projectName,
      comment_preview: preview,
    }
  );
}

/**
 * Notify user when they are mentioned in a comment
 */
export async function notifyCommentMention(
  mentionedUserId: string,
  commentId: string,
  taskId: string,
  taskTitle: string,
  projectId: string,
  projectName: string,
  commenterName: string | null,
  commentPreview: string
): Promise<void> {
  // Truncate comment preview
  const preview = commentPreview.length > 100 
    ? commentPreview.substring(0, 100) + '...' 
    : commentPreview;

  await createNotification(
    mentionedUserId,
    'comment_mention',
    'You Were Mentioned',
    `${commenterName || 'Someone'} mentioned you in a comment on "${taskTitle}" in ${projectName}: "${preview}"`,
    {
      comment_id: commentId,
      task_id: taskId,
      project_id: projectId,
      task_title: taskTitle,
      project_name: projectName,
      comment_preview: preview,
    }
  );
}

/**
 * Notify project owner when a project is created (if different from creator)
 */
export async function notifyProjectCreated(
  ownerId: string,
  creatorId: string,
  projectId: string,
  projectName: string,
  creatorName: string | null
): Promise<void> {
  // Don't notify if creator is the owner
  if (ownerId === creatorId) {
    return;
  }

  await createNotification(
    ownerId,
    'project_created',
    'New Project Created',
    `${creatorName || 'Someone'} created the project "${projectName}"`,
    {
      project_id: projectId,
      project_name: projectName,
    }
  );
}

/**
 * Notify user when they are added to a project
 */
export async function notifyProjectMemberAdded(
  addedUserId: string,
  projectId: string,
  projectName: string,
  addedById: string,
  addedByName: string | null
): Promise<void> {
  await createNotification(
    addedUserId,
    'project_member_added',
    'Added to Project',
    `${addedByName || 'Someone'} added you to the project "${projectName}"`,
    {
      project_id: projectId,
      project_name: projectName,
      added_by_id: addedById,
      added_by_name: addedByName || 'Unknown',
    }
  );
}

