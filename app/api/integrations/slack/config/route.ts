import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId, hasFeatureAccess } from '@/lib/organizationContext';
import { getOrganizationSlackIntegration, getSlackAppConfig } from '@/lib/slackService';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { SlackIntegrationConfig } from '@/types/integrations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/slack/config
 * Get Slack integration configuration for organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return forbidden('You must belong to an organization');
    }

    // Check if organization has Slack integration feature enabled
    const hasAccess = await hasFeatureAccess(supabase, organizationId, 'slack_integration_enabled');

    // Check if Slack app is configured
    const appConfig = await getSlackAppConfig();
    const slackEnabled = appConfig?.enabledForOrganizations ?? false;

    // Get integration if exists
    const integration = await getOrganizationSlackIntegration(organizationId);

    return NextResponse.json({
      featureEnabled: hasAccess,
      slackAppConfigured: !!appConfig,
      slackEnabled,
      connected: !!integration,
      integration: integration
        ? {
            teamId: integration.teamId,
            teamName: integration.teamName,
            config: integration.config as unknown as SlackIntegrationConfig,
          }
        : null,
    });
  } catch (error) {
    logger.error('Error in GET /api/integrations/slack/config:', error);
    return internalError('Failed to get Slack configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PATCH /api/integrations/slack/config
 * Update Slack integration configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return forbidden('You must belong to an organization');
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return forbidden('Only organization admins can update Slack configuration');
    }

    // Get existing integration
    const integration = await getOrganizationSlackIntegration(organizationId);
    if (!integration) {
      return notFound('No Slack integration found. Please connect Slack first.');
    }

    // Parse request body
    const body = await request.json();
    const { config: newConfig } = body;

    if (!newConfig || typeof newConfig !== 'object') {
      return badRequest('Configuration object is required');
    }

    // Merge with existing config
    const existingConfig = integration.config as unknown as SlackIntegrationConfig;
    const updatedConfig: SlackIntegrationConfig = {
      default_channel: newConfig.default_channel ?? existingConfig.default_channel,
      default_channel_id: newConfig.default_channel_id ?? existingConfig.default_channel_id,
      notifications: {
        ...existingConfig.notifications,
        ...newConfig.notifications,
      },
      user_mapping: {
        ...existingConfig.user_mapping,
        ...newConfig.user_mapping,
      },
    };

    // Update in database
    const adminClient = createAdminSupabaseClient();
    const { error: updateError } = await adminClient
      .from('organization_integrations')
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (updateError) {
      logger.error('[Slack Config] Failed to update config:', updateError);
      return internalError('Failed to update Slack configuration', {
        error: updateError.message,
      });
    }

    logger.info('[Slack Config] Configuration updated', {
      organizationId,
      integrationId: integration.id,
    });

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    logger.error('Error in PATCH /api/integrations/slack/config:', error);
    return internalError('Failed to update Slack configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
