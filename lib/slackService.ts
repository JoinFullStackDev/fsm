/**
 * Slack Service
 * Core service for interacting with the Slack API
 */

import { createAdminSupabaseClient } from './supabaseAdmin';
import { decryptApiKey } from './apiKeys';
import logger from './utils/logger';
import type {
  SlackOAuthResponse,
  SlackPostMessageResponse,
  SlackChannelListResponse,
  SlackChannel,
  DEFAULT_SLACK_SCOPES,
} from '@/types/integrations';

const SLACK_API_BASE = 'https://slack.com/api';
const SLACK_OAUTH_URL = 'https://slack.com/oauth/v2/authorize';

/**
 * Get Slack app configuration from system_connections
 */
export async function getSlackAppConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  signingSecret?: string;
  scopes: string[];
  enabledForOrganizations: boolean;
} | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: connection, error } = await adminClient
      .from('system_connections')
      .select('config, is_active')
      .eq('connection_type', 'slack')
      .single();

    if (error || !connection) {
      logger.warn('[SlackService] No Slack connection configured');
      return null;
    }

    if (!connection.is_active) {
      logger.warn('[SlackService] Slack connection is not active');
      return null;
    }

    const config = connection.config as Record<string, unknown>;
    if (!config.client_id || !config.client_secret) {
      logger.warn('[SlackService] Slack connection missing client_id or client_secret');
      return null;
    }

    // Decrypt secrets
    const clientSecret = decryptApiKey(config.client_secret as string);
    const signingSecret = config.signing_secret
      ? decryptApiKey(config.signing_secret as string)
      : undefined;

    return {
      clientId: config.client_id as string,
      clientSecret,
      signingSecret,
      scopes: (config.scopes as string[]) || [
        'chat:write',
        'chat:write.public',
        'channels:read',
        'users:read',
        'users:read.email',
      ],
      enabledForOrganizations: config.enabled_for_organizations !== false,
    };
  } catch (error) {
    logger.error('[SlackService] Error getting Slack app config:', error);
    return null;
  }
}

/**
 * Generate OAuth authorization URL
 */
export async function generateOAuthUrl(
  organizationId: string,
  redirectUri: string
): Promise<string | null> {
  const config = await getSlackAppConfig();
  if (!config) {
    return null;
  }

  // Generate state parameter with organization ID for security
  const state = Buffer.from(
    JSON.stringify({
      organizationId,
      timestamp: Date.now(),
    })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(','),
    redirect_uri: redirectUri,
    state,
  });

  return `${SLACK_OAUTH_URL}?${params.toString()}`;
}

/**
 * Parse and validate state parameter from OAuth callback
 */
export function parseOAuthState(state: string): {
  organizationId: string;
  timestamp: number;
} | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);

    if (!parsed.organizationId || !parsed.timestamp) {
      return null;
    }

    // Check if state is not too old (5 minutes)
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - parsed.timestamp > maxAge) {
      logger.warn('[SlackService] OAuth state expired');
      return null;
    }

    return parsed;
  } catch {
    logger.error('[SlackService] Error parsing OAuth state');
    return null;
  }
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<SlackOAuthResponse | null> {
  const config = await getSlackAppConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      logger.error('[SlackService] OAuth token exchange failed:', data.error);
      return null;
    }

    return data as SlackOAuthResponse;
  } catch (error) {
    logger.error('[SlackService] Error exchanging OAuth code:', error);
    return null;
  }
}

/**
 * Post a message to a Slack channel
 */
export async function postMessage(
  accessToken: string,
  channel: string,
  text: string,
  options?: {
    blocks?: unknown[];
    username?: string;
    iconEmoji?: string;
    notifyChannel?: boolean;
  }
): Promise<SlackPostMessageResponse | null> {
  try {
    let messageText = text;
    if (options?.notifyChannel) {
      messageText = `<!channel> ${text}`;
    }

    const body: Record<string, unknown> = {
      channel,
      text: messageText,
    };

    if (options?.blocks) {
      body.blocks = options.blocks;
    }
    if (options?.username) {
      body.username = options.username;
    }
    if (options?.iconEmoji) {
      body.icon_emoji = options.iconEmoji;
    }

    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      logger.error('[SlackService] Failed to post message:', data.error);
      return null;
    }

    return data as SlackPostMessageResponse;
  } catch (error) {
    logger.error('[SlackService] Error posting message:', error);
    return null;
  }
}

/**
 * List channels the bot has access to
 */
export async function listChannels(
  accessToken: string,
  options?: {
    excludeArchived?: boolean;
    limit?: number;
  }
): Promise<SlackChannel[]> {
  try {
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        exclude_archived: String(options?.excludeArchived !== false),
        limit: String(options?.limit || 200),
        types: 'public_channel,private_channel',
      });

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(
        `${SLACK_API_BASE}/conversations.list?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data: SlackChannelListResponse = await response.json();

      if (!data.ok) {
        logger.error('[SlackService] Failed to list channels:', data.error);
        break;
      }

      channels.push(
        ...data.channels.map((c) => ({
          id: c.id,
          name: c.name,
          is_private: c.is_private,
          is_member: c.is_member,
          num_members: c.num_members,
        }))
      );

      cursor = data.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  } catch (error) {
    logger.error('[SlackService] Error listing channels:', error);
    return [];
  }
}

/**
 * Get a Slack user by email
 */
export async function getUserByEmail(
  accessToken: string,
  email: string
): Promise<{ id: string; name: string; real_name: string } | null> {
  try {
    const response = await fetch(
      `${SLACK_API_BASE}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!data.ok) {
      if (data.error !== 'users_not_found') {
        logger.warn('[SlackService] Failed to lookup user:', data.error);
      }
      return null;
    }

    return {
      id: data.user.id,
      name: data.user.name,
      real_name: data.user.real_name || data.user.name,
    };
  } catch (error) {
    logger.error('[SlackService] Error looking up user:', error);
    return null;
  }
}

/**
 * Revoke an access token
 */
export async function revokeToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${SLACK_API_BASE}/auth.revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!data.ok) {
      logger.error('[SlackService] Failed to revoke token:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[SlackService] Error revoking token:', error);
    return false;
  }
}

/**
 * Test the connection by calling auth.test
 */
export async function testConnection(
  accessToken: string
): Promise<{ ok: boolean; team?: string; user?: string; error?: string }> {
  try {
    const response = await fetch(`${SLACK_API_BASE}/auth.test`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!data.ok) {
      return { ok: false, error: data.error };
    }

    return {
      ok: true,
      team: data.team,
      user: data.user,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify Slack request signature (for incoming webhooks)
 */
export async function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  const config = await getSlackAppConfig();
  if (!config || !config.signingSecret) {
    logger.warn('[SlackService] No signing secret configured');
    return false;
  }

  try {
    // Check timestamp to prevent replay attacks (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - requestTime) > 60 * 5) {
      logger.warn('[SlackService] Request timestamp too old');
      return false;
    }

    // Create signature base string
    const sigBaseString = `v0:${timestamp}:${body}`;

    // Compute HMAC-SHA256
    const crypto = await import('crypto');
    const mySignature =
      'v0=' +
      crypto
        .createHmac('sha256', config.signingSecret)
        .update(sigBaseString)
        .digest('hex');

    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(mySignature)
    );
  } catch (error) {
    logger.error('[SlackService] Error verifying signature:', error);
    return false;
  }
}

/**
 * Get organization's Slack integration
 */
export async function getOrganizationSlackIntegration(
  organizationId: string
): Promise<{
  id: string;
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  config: Record<string, unknown>;
} | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: integration, error } = await adminClient
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_type', 'slack')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return null;
    }

    // Decrypt access token
    const accessToken = decryptApiKey(integration.access_token_encrypted);

    return {
      id: integration.id,
      accessToken,
      teamId: integration.team_id,
      teamName: integration.team_name,
      botUserId: integration.bot_user_id,
      config: integration.config || {},
    };
  } catch (error) {
    logger.error('[SlackService] Error getting organization Slack integration:', error);
    return null;
  }
}
