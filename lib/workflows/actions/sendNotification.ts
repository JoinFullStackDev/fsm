/**
 * Send Notification Actions
 * Sends in-app and push notifications via existing notification services
 */

import { createNotification } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/pushNotifications';
import { interpolateTemplate, getNestedValue } from '../templating';
import type { SendNotificationConfig, WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute send in-app notification action
 * 
 * @param config - Notification configuration
 * @param context - Workflow context
 * @returns Action result with notification details
 */
export async function executeSendNotification(
  config: SendNotificationConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const notifConfig = config as SendNotificationConfig;
  
  // Get user ID from config or context
  let userId: string | undefined;
  
  if (notifConfig.user_id) {
    userId = interpolateTemplate(notifConfig.user_id, context);
  } else if (notifConfig.user_field) {
    const fieldValue = getNestedValue(context, notifConfig.user_field);
    userId = typeof fieldValue === 'string' ? fieldValue : undefined;
  }
  
  if (!userId) {
    logger.warn('[SendNotification] No user ID found, skipping notification');
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No user ID found',
      },
    };
  }
  
  // Interpolate message content
  const title = interpolateTemplate(notifConfig.title, context);
  const message = interpolateTemplate(notifConfig.message, context);
  
  // Interpolate metadata if present
  const metadata = notifConfig.metadata 
    ? interpolateMetadata(notifConfig.metadata, context)
    : {};
  
  logger.info('[SendNotification] Sending notification:', {
    userId,
    title,
    type: notifConfig.type,
  });
  
  try {
    const notification = await createNotification(
      userId,
      (notifConfig.type as 'task_assigned' | 'comment_created' | 'comment_mention' | 'project_created' | 'project_member_added' | 'kb_article_published' | 'kb_article_updated' | 'kb_category_added' | 'kb_release_notes_published' | 'workflow_notification') || 'workflow_notification',
      title,
      message,
      metadata
    );
    
    if (!notification) {
      logger.warn('[SendNotification] Notification not created (user may have disabled notifications)');
      return {
        output: {
          success: false,
          skipped: true,
          reason: 'Notification not created - user may have disabled notifications',
          user_id: userId,
        },
      };
    }
    
    logger.info('[SendNotification] Notification created:', {
      notificationId: notification.id,
      userId,
    });
    
    return {
      output: {
        success: true,
        notification_id: notification.id,
        user_id: userId,
        title,
        sent_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[SendNotification] Error creating notification:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute send push notification action
 * 
 * @param config - Notification configuration
 * @param context - Workflow context
 * @returns Action result with push notification details
 */
export async function executeSendPush(
  config: SendNotificationConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const notifConfig = config as SendNotificationConfig;
  
  // Get user ID from config or context
  let userId: string | undefined;
  
  if (notifConfig.user_id) {
    userId = interpolateTemplate(notifConfig.user_id, context);
  } else if (notifConfig.user_field) {
    const fieldValue = getNestedValue(context, notifConfig.user_field);
    userId = typeof fieldValue === 'string' ? fieldValue : undefined;
  }
  
  if (!userId) {
    logger.warn('[SendPush] No user ID found, skipping push notification');
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No user ID found',
      },
    };
  }
  
  // Interpolate message content
  const title = interpolateTemplate(notifConfig.title, context);
  const message = interpolateTemplate(notifConfig.message, context);
  
  // Interpolate metadata if present
  const metadata = notifConfig.metadata 
    ? interpolateMetadata(notifConfig.metadata, context)
    : {};
  
  logger.info('[SendPush] Sending push notification:', {
    userId,
    title,
  });
  
  try {
    const success = await sendPushNotification(
      userId,
      title,
      message,
      metadata
    );
    
    if (!success) {
      logger.warn('[SendPush] Push notification failed - user may not have push enabled');
      return {
        output: {
          success: false,
          skipped: true,
          reason: 'Push notification failed - user may not have push enabled',
          user_id: userId,
        },
      };
    }
    
    logger.info('[SendPush] Push notification sent:', { userId });
    
    return {
      output: {
        success: true,
        user_id: userId,
        title,
        sent_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[SendPush] Error sending push notification:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Interpolate metadata object values
 */
function interpolateMetadata(
  metadata: Record<string, unknown>,
  context: WorkflowContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      result[key] = interpolateTemplate(value, context);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

