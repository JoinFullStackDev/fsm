import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { sendPushNotification } from '@/lib/pushNotifications';
import { sendEmailWithRetry, isEmailConfigured } from '@/lib/emailService';
import logger from '@/lib/utils/logger';
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

    // Check user preferences for in-app and email notifications
    const { data: user } = await adminClient
      .from('users')
      .select('preferences, email, name')
      .eq('id', userId)
      .single();

    // Respect user preferences - if inApp notifications are disabled, don't create
    if (user?.preferences?.notifications?.inApp === false) {
      logger.debug('[Notifications] Skipping notification - user has in-app notifications disabled:', userId);
      return null;
    }

    // Check if email notifications are enabled (default to true if not set)
    const emailEnabled = user?.preferences?.notifications?.email !== false;
    
    // Send email notification if enabled and email service is configured (non-blocking)
    if (emailEnabled && user?.email) {
      isEmailConfigured().then((configured) => {
        if (configured) {
          // Email sending will be handled by specific notification functions
          // This is just a placeholder for future email integration
        }
      }).catch((error) => {
        logger.error('[Notifications] Error checking email configuration:', error);
      });
    }

    logger.debug('[Notifications] Attempting to create notification:', {
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
      logger.error('[Notifications] Error creating notification:', {
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

    logger.debug('[Notifications] Notification created successfully:', {
      id: notification?.id,
      userId,
      type,
    });

    // Send push notification if enabled (non-blocking)
    sendPushNotification(userId, title, message, metadata).catch((error) => {
      logger.error('[Notifications] Error sending push notification:', error);
      // Don't fail the notification creation if push fails
    });

    return notification;
  } catch (error) {
    logger.error('[Notifications] Error creating notification:', error);
    return null;
  }
}

/**
 * Notify users when a KB article is published
 */
export async function notifyArticlePublished(
  organizationId: string | null,
  articleId: string,
  articleTitle: string,
  authorId: string,
  authorName: string | null
): Promise<void> {
  try {
    // Get all users in the organization (or all users if global)
    const supabase = await createServerSupabaseClient();
    let usersQuery = supabase.from('users').select('id');

    if (organizationId) {
      usersQuery = usersQuery.eq('organization_id', organizationId);
    } else {
      // For global articles, notify all users
      usersQuery = usersQuery.not('organization_id', 'is', null);
    }

    const { data: users } = await usersQuery;

    if (!users || users.length === 0) {
      return;
    }

    const articleLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/kb/${articleId}`;
    const authorDisplayName = authorName || 'Someone';

    // Create notifications for all users
    const notifications = users
      .filter(user => user.id !== authorId) // Don't notify the author
      .map(user => ({
        user_id: user.id,
        type: 'kb_article_published' as NotificationType,
        title: 'New Article Published',
        message: `${authorDisplayName} published "${articleTitle}"`,
        metadata: {
          article_id: articleId,
          article_title: articleTitle,
          author_id: authorId,
          author_name: authorName,
          link: articleLink,
        },
      }));

    // Create notifications in batch
    for (const notification of notifications) {
      await createNotification(
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        notification.metadata
      );
    }
  } catch (error) {
    logger.error('[Notifications] Error notifying article published:', error);
  }
}

/**
 * Notify users when a KB article is updated
 */
export async function notifyArticleUpdated(
  organizationId: string | null,
  articleId: string,
  articleTitle: string,
  updaterId: string,
  updaterName: string | null
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    let usersQuery = supabase.from('users').select('id');

    if (organizationId) {
      usersQuery = usersQuery.eq('organization_id', organizationId);
    } else {
      usersQuery = usersQuery.not('organization_id', 'is', null);
    }

    const { data: users } = await usersQuery;

    if (!users || users.length === 0) {
      return;
    }

    const articleLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/kb/${articleId}`;
    const updaterDisplayName = updaterName || 'Someone';

    const notifications = users
      .filter(user => user.id !== updaterId)
      .map(user => ({
        user_id: user.id,
        type: 'kb_article_updated' as NotificationType,
        title: 'Article Updated',
        message: `${updaterDisplayName} updated "${articleTitle}"`,
        metadata: {
          article_id: articleId,
          article_title: articleTitle,
          updater_id: updaterId,
          updater_name: updaterName,
          link: articleLink,
        },
      }));

    for (const notification of notifications) {
      await createNotification(
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        notification.metadata
      );
    }
  } catch (error) {
    logger.error('[Notifications] Error notifying article updated:', error);
  }
}

/**
 * Notify users when a KB category is added
 */
export async function notifyCategoryAdded(
  organizationId: string | null,
  categoryId: string,
  categoryName: string,
  creatorId: string,
  creatorName: string | null
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    let usersQuery = supabase.from('users').select('id');

    if (organizationId) {
      usersQuery = usersQuery.eq('organization_id', organizationId);
    } else {
      usersQuery = usersQuery.not('organization_id', 'is', null);
    }

    const { data: users } = await usersQuery;

    if (!users || users.length === 0) {
      return;
    }

    const kbLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/kb`;
    const creatorDisplayName = creatorName || 'Someone';

    const notifications = users
      .filter(user => user.id !== creatorId)
      .map(user => ({
        user_id: user.id,
        type: 'kb_category_added' as NotificationType,
        title: 'New Category Added',
        message: `${creatorDisplayName} added category "${categoryName}"`,
        metadata: {
          category_id: categoryId,
          category_name: categoryName,
          creator_id: creatorId,
          creator_name: creatorName,
          link: kbLink,
        },
      }));

    for (const notification of notifications) {
      await createNotification(
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        notification.metadata
      );
    }
  } catch (error) {
    logger.error('[Notifications] Error notifying category added:', error);
  }
}

/**
 * Notify users when release notes are published
 */
export async function notifyReleaseNotesPublished(
  organizationId: string | null,
  articleId: string,
  releaseTitle: string,
  publisherId: string,
  publisherName: string | null
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    let usersQuery = supabase.from('users').select('id');

    if (organizationId) {
      usersQuery = usersQuery.eq('organization_id', organizationId);
    } else {
      usersQuery = usersQuery.not('organization_id', 'is', null);
    }

    const { data: users } = await usersQuery;

    if (!users || users.length === 0) {
      return;
    }

    const articleLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/kb/${articleId}`;
    const publisherDisplayName = publisherName || 'Someone';

    const notifications = users.map(user => ({
      user_id: user.id,
      type: 'kb_release_notes_published' as NotificationType,
      title: 'New Release Notes',
      message: `${publisherDisplayName} published release notes: "${releaseTitle}"`,
      metadata: {
        article_id: articleId,
        release_title: releaseTitle,
        publisher_id: publisherId,
        publisher_name: publisherName,
        link: articleLink,
      },
    }));

    for (const notification of notifications) {
      await createNotification(
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        notification.metadata
      );
    }
  } catch (error) {
    logger.error('[Notifications] Error notifying release notes:', error);
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

