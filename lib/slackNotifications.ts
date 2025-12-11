/**
 * Slack Notification Service
 * Sends notifications to Slack based on organization configuration
 */

import { getOrganizationSlackIntegration, postMessage } from './slackService';
import logger from './utils/logger';
import type { NotificationType } from '@/types/project';
import type { SlackIntegrationConfig, SlackNotificationType } from '@/types/integrations';

/**
 * Map FSM notification types to Slack notification types
 */
const NOTIFICATION_TYPE_MAP: Record<NotificationType, SlackNotificationType | null> = {
  task_assigned: 'task_assigned',
  comment_created: 'comment_created',
  comment_mention: 'comment_mention',
  project_created: 'project_created',
  project_member_added: 'project_created', // Use project_created channel
  kb_article_published: null, // Not mapped to Slack
  kb_article_updated: null,
  kb_category_added: null,
  kb_release_notes_published: null,
  workflow_notification: 'workflow_triggered',
};

/**
 * Format notification for Slack
 */
function formatSlackMessage(
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): { text: string; blocks?: unknown[] } {
  // Create a rich block message
  const blocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*\n${message}`,
      },
    },
  ];

  // Add link if available in metadata
  if (metadata?.link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in FSM',
            emoji: true,
          },
          url: metadata.link as string,
          action_id: 'view_in_fsm',
        },
      ],
    });
  }

  // Add context with metadata
  const contextElements: unknown[] = [];

  if (metadata?.project_name) {
    contextElements.push({
      type: 'mrkdwn',
      text: `Project: *${metadata.project_name}*`,
    });
  }

  if (metadata?.assigner_name) {
    contextElements.push({
      type: 'mrkdwn',
      text: `By: ${metadata.assigner_name}`,
    });
  }

  if (contextElements.length > 0) {
    blocks.push({
      type: 'context',
      elements: contextElements,
    });
  }

  return {
    text: `${title}: ${message}`, // Fallback text
    blocks,
  };
}

/**
 * Get the emoji icon for a notification type
 */
function getNotificationEmoji(type: NotificationType): string {
  const emojiMap: Partial<Record<NotificationType, string>> = {
    task_assigned: ':clipboard:',
    comment_created: ':speech_balloon:',
    comment_mention: ':mega:',
    project_created: ':rocket:',
    project_member_added: ':busts_in_silhouette:',
    workflow_notification: ':gear:',
  };

  return emojiMap[type] || ':bell:';
}

/**
 * Send a Slack notification if organization has Slack configured and notification type is enabled
 *
 * @param organizationId - The organization ID
 * @param type - The notification type
 * @param title - The notification title
 * @param message - The notification message
 * @param metadata - Optional metadata (project_id, task_id, etc.)
 * @returns Whether the notification was sent successfully
 */
export async function sendSlackNotificationIfConfigured(
  organizationId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    // Get organization's Slack integration
    const integration = await getOrganizationSlackIntegration(organizationId);

    if (!integration) {
      // No Slack integration - this is fine, just skip
      return false;
    }

    const config = integration.config as unknown as SlackIntegrationConfig;

    // Map notification type to Slack notification type
    const slackNotificationType = NOTIFICATION_TYPE_MAP[type];
    if (!slackNotificationType) {
      // This notification type is not mapped to Slack
      return false;
    }

    // Check if this notification type is enabled
    const notificationConfig = config.notifications?.[slackNotificationType];
    if (!notificationConfig?.enabled) {
      logger.debug('[SlackNotifications] Notification type disabled', {
        organizationId,
        type,
        slackType: slackNotificationType,
      });
      return false;
    }

    // Determine which channel to use
    const channel =
      notificationConfig.channel ||
      notificationConfig.channel_id ||
      config.default_channel ||
      config.default_channel_id;

    if (!channel) {
      logger.warn('[SlackNotifications] No channel configured', {
        organizationId,
        type,
      });
      return false;
    }

    // Format the message
    const { text, blocks } = formatSlackMessage(type, title, message, metadata);

    // Send the message
    const result = await postMessage(integration.accessToken, channel, text, {
      blocks,
      iconEmoji: getNotificationEmoji(type),
    });

    if (!result) {
      logger.error('[SlackNotifications] Failed to send notification', {
        organizationId,
        type,
        channel,
      });
      return false;
    }

    logger.info('[SlackNotifications] Notification sent', {
      organizationId,
      type,
      channel,
      messageTs: result.ts,
    });

    return true;
  } catch (error) {
    logger.error('[SlackNotifications] Error sending notification:', {
      organizationId,
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Send a direct Slack message (for workflow actions)
 */
export async function sendSlackDirectMessage(
  organizationId: string,
  channel: string,
  message: string,
  options?: {
    blocks?: unknown[];
    notifyChannel?: boolean;
  }
): Promise<boolean> {
  try {
    const integration = await getOrganizationSlackIntegration(organizationId);

    if (!integration) {
      logger.warn('[SlackNotifications] No Slack integration for direct message', {
        organizationId,
      });
      return false;
    }

    const result = await postMessage(integration.accessToken, channel, message, {
      blocks: options?.blocks,
      notifyChannel: options?.notifyChannel,
    });

    return !!result;
  } catch (error) {
    logger.error('[SlackNotifications] Error sending direct message:', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
