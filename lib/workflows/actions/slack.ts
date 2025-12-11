/**
 * Slack Workflow Actions
 * Send messages to Slack channels via workflow automation
 */

import { getOrganizationSlackIntegration, postMessage } from '@/lib/slackService';
import { interpolateTemplate } from '../templating';
import type { SendSlackConfig, WorkflowContext } from '@/types/workflows';
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
