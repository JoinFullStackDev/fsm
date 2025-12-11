/**
 * Integration Type Definitions
 * Types for third-party integrations like Slack, Teams, etc.
 */

// ============================================
// SLACK INTEGRATION TYPES
// ============================================

export interface SlackIntegration {
  id: string;
  organization_id: string;
  integration_type: 'slack';
  team_id: string;
  team_name: string;
  bot_user_id: string;
  config: SlackIntegrationConfig;
  is_active: boolean;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
}

export interface SlackIntegrationConfig {
  /** Default channel for notifications if not specified per-type */
  default_channel?: string;
  /** Default channel ID for notifications */
  default_channel_id?: string;
  /** Notification preferences per type */
  notifications: SlackNotificationPreferences;
  /** User mapping settings */
  user_mapping: {
    /** Automatically match FSM users to Slack users by email */
    auto_match_by_email: boolean;
  };
}

export interface SlackNotificationPreference {
  enabled: boolean;
  /** Override channel for this notification type */
  channel?: string;
  channel_id?: string;
}

export interface SlackNotificationPreferences {
  task_assigned?: SlackNotificationPreference;
  task_completed?: SlackNotificationPreference;
  project_created?: SlackNotificationPreference;
  project_completed?: SlackNotificationPreference;
  comment_created?: SlackNotificationPreference;
  comment_mention?: SlackNotificationPreference;
  workflow_triggered?: SlackNotificationPreference;
  phase_completed?: SlackNotificationPreference;
}

export type SlackNotificationType = keyof SlackNotificationPreferences;

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  num_members?: number;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  email?: string;
  is_bot: boolean;
}

// ============================================
// SLACK API RESPONSE TYPES
// ============================================

export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

export interface SlackPostMessageResponse {
  ok: boolean;
  channel: string;
  ts: string;
  message?: {
    text: string;
    ts: string;
  };
  error?: string;
}

export interface SlackChannelListResponse {
  ok: boolean;
  channels: SlackChannel[];
  response_metadata?: {
    next_cursor: string;
  };
  error?: string;
}

// ============================================
// ORGANIZATION INTEGRATION BASE TYPES
// ============================================

export type IntegrationType = 'slack' | 'microsoft_teams' | 'discord';

export interface OrganizationIntegration {
  id: string;
  organization_id: string;
  integration_type: IntegrationType;
  access_token_encrypted: string | null;
  bot_user_id: string | null;
  team_id: string | null;
  team_name: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
}

// ============================================
// SLACK SYSTEM CONFIG (Super Admin)
// ============================================

export interface SlackSystemConfig {
  client_id: string;
  /** Indicates if client secret is configured (actual secret not returned) */
  has_client_secret: boolean;
  /** Indicates if signing secret is configured (actual secret not returned) */
  has_signing_secret: boolean;
  /** Whether Slack integration is enabled for organizations */
  enabled_for_organizations: boolean;
  /** OAuth scopes to request */
  scopes: string[];
}

export const DEFAULT_SLACK_SCOPES = [
  'chat:write',
  'chat:write.public',
  'channels:read',
  'users:read',
  'users:read.email',
];
