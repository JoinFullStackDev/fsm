/**
 * Slack Workflow Actions
 * Send messages to Slack channels and create channels via workflow automation
 */

import {
  getOrganizationSlackIntegration,
  postMessage,
  createChannel,
  inviteUsersToChannel,
} from '@/lib/slackService';
import { interpolateTemplate } from '../templating';
import type { SendSlackConfig, CreateSlackChannelConfig, WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute send Slack message action
 *
 * @param config - Slack message configuration
 * @param context - Workflow context
 * @returns Action result with message details
 */
export async function executeSendSlack(
  config: SendSlackConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const slackConfig = config as SendSlackConfig;

  // Get organization's Slack integration
  const integration = await getOrganizationSlackIntegration(context.organization_id);

  if (!integration) {
    logger.warn('[SendSlack] No Slack integration found for organization', {
      organizationId: context.organization_id,
    });
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No Slack integration configured for this organization',
      },
    };
  }

  // Interpolate channel and message with template variables
  const channel = interpolateTemplate(slackConfig.channel, context);
  const message = interpolateTemplate(slackConfig.message, context);

  // Validate channel
  if (!channel) {
    logger.warn('[SendSlack] No channel specified');
    return {
      output: {
        success: false,
        error: 'No channel specified',
      },
    };
  }

  // Validate message
  if (!message) {
    logger.warn('[SendSlack] No message specified');
    return {
      output: {
        success: false,
        error: 'No message specified',
      },
    };
  }

  logger.info('[SendSlack] Sending Slack message', {
    organizationId: context.organization_id,
    channel,
    messagePreview: message.substring(0, 100),
  });

  try {
    // Build blocks if use_blocks is enabled
    let blocks: unknown[] | undefined;
    if (slackConfig.use_blocks) {
      // Create a simple block with the message
      blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ];

      // Add context block with workflow info
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Sent via FSM Workflow at ${new Date().toLocaleString()}`,
          },
        ],
      });
    }

    // Send message to Slack
    const result = await postMessage(integration.accessToken, channel, message, {
      blocks,
      username: slackConfig.username,
      iconEmoji: slackConfig.icon_emoji,
      notifyChannel: slackConfig.notify_channel,
    });

    if (!result) {
      logger.error('[SendSlack] Failed to send message');
      return {
        output: {
          success: false,
          error: 'Failed to send Slack message',
          channel,
        },
      };
    }

    logger.info('[SendSlack] Message sent successfully', {
      organizationId: context.organization_id,
      channel: result.channel,
      messageTs: result.ts,
    });

    return {
      output: {
        success: true,
        channel: result.channel,
        message_ts: result.ts,
        sent_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error('[SendSlack] Error sending message:', {
      organizationId: context.organization_id,
      channel,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute create Slack channel action
 *
 * @param config - Slack channel configuration
 * @param context - Workflow context
 * @returns Action result with channel details
 */
export async function executeCreateSlackChannel(
  config: CreateSlackChannelConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const channelConfig = config as CreateSlackChannelConfig;

  // Get organization's Slack integration
  const integration = await getOrganizationSlackIntegration(context.organization_id);

  if (!integration) {
    logger.warn('[CreateSlackChannel] No Slack integration found for organization', {
      organizationId: context.organization_id,
    });
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No Slack integration configured for this organization',
      },
    };
  }

  // Interpolate channel name with template variables
  const channelName = interpolateTemplate(channelConfig.channel_name, context);

  if (!channelName) {
    logger.warn('[CreateSlackChannel] No channel name specified');
    return {
      output: {
        success: false,
        error: 'No channel name specified',
      },
    };
  }

  // Interpolate description if provided
  const description = channelConfig.description
    ? interpolateTemplate(channelConfig.description, context)
    : undefined;

  logger.info('[CreateSlackChannel] Creating Slack channel', {
    organizationId: context.organization_id,
    channelName,
    isPrivate: channelConfig.is_private,
  });

  try {
    // Create the channel
    const result = await createChannel(integration.accessToken, channelName, {
      isPrivate: channelConfig.is_private,
      description,
    });

    if (!result) {
      logger.error('[CreateSlackChannel] Failed to create channel');
      return {
        output: {
          success: false,
          error: 'Failed to create Slack channel',
          requested_name: channelName,
        },
      };
    }

    // Invite users if specified
    let invitedUsers: string[] = [];
    const userIdsToInvite: string[] = [];

    // Add static user IDs
    if (channelConfig.invite_user_ids?.length) {
      userIdsToInvite.push(...channelConfig.invite_user_ids);
    }

    // Add user IDs from context field
    if (channelConfig.invite_users_field) {
      const fieldValue = interpolateTemplate(`{{${channelConfig.invite_users_field}}}`, context);
      if (fieldValue && fieldValue !== `{{${channelConfig.invite_users_field}}}`) {
        try {
          const parsed = JSON.parse(fieldValue);
          if (Array.isArray(parsed)) {
            userIdsToInvite.push(...parsed);
          }
        } catch {
          // If not JSON, treat as single ID
          userIdsToInvite.push(fieldValue);
        }
      }
    }

    if (userIdsToInvite.length > 0) {
      const uniqueUserIds = [...new Set(userIdsToInvite)];
      const inviteSuccess = await inviteUsersToChannel(
        integration.accessToken,
        result.id,
        uniqueUserIds
      );
      if (inviteSuccess) {
        invitedUsers = uniqueUserIds;
      }
    }

    // Post initial message if provided
    let initialMessageResult = null;
    if (channelConfig.initial_message) {
      const initialMessage = interpolateTemplate(channelConfig.initial_message, context);
      if (initialMessage) {
        initialMessageResult = await postMessage(
          integration.accessToken,
          result.id,
          initialMessage
        );
      }
    }

    logger.info('[CreateSlackChannel] Channel created successfully', {
      organizationId: context.organization_id,
      channelId: result.id,
      channelName: result.name,
      isPrivate: result.is_private,
      invitedUsers: invitedUsers.length,
    });

    const output: Record<string, unknown> = {
      success: true,
      channel_id: result.id,
      channel_name: result.name,
      is_private: result.is_private,
      created_at: new Date().toISOString(),
      invited_users: invitedUsers,
    };

    if (initialMessageResult) {
      output.initial_message_ts = initialMessageResult.ts;
    }

    return { output };
  } catch (error) {
    logger.error('[CreateSlackChannel] Error creating channel:', {
      organizationId: context.organization_id,
      channelName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
