import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId, validateOrganizationAccess } from '@/lib/organizationContext';
import { exchangeCodeForToken, parseOAuthState } from '@/lib/slackService';
import { encryptApiKey } from '@/lib/apiKeys';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/slack/callback
 * Handle OAuth callback from Slack
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const settingsUrl = `${baseUrl}/admin`;

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error (user denied access)
    if (error) {
      logger.warn('[Slack Callback] OAuth error:', error);
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('[Slack Callback] Missing code or state parameter');
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=missing_parameters`
      );
    }

    // Parse and validate state
    const stateData = parseOAuthState(state);
    if (!stateData) {
      logger.error('[Slack Callback] Invalid or expired state');
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=invalid_state`
      );
    }

    const { organizationId } = stateData;

    // Verify user is logged in and has access
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error('[Slack Callback] User not authenticated');
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=not_authenticated`
      );
    }

    // Verify user has access to this organization
    const hasAccess = await validateOrganizationAccess(supabase, user.id, organizationId);
    if (!hasAccess) {
      logger.error('[Slack Callback] User does not have access to organization');
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=access_denied`
      );
    }

    // Get user ID for connected_by field
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      logger.error('[Slack Callback] User is not an admin');
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=admin_required`
      );
    }

    // Exchange code for access token
    const redirectUri = `${baseUrl}/api/integrations/slack/callback`;
    const tokenResponse = await exchangeCodeForToken(code, redirectUri);

    if (!tokenResponse) {
      logger.error('[Slack Callback] Failed to exchange code for token');
      return NextResponse.redirect(
        `${settingsUrl}?slack_error=token_exchange_failed`
      );
    }

    // Encrypt the access token
    const encryptedToken = encryptApiKey(tokenResponse.access_token);

    // Store integration in database
    const adminClient = createAdminSupabaseClient();

    // Check if integration already exists (update) or create new
    const { data: existing } = await adminClient
      .from('organization_integrations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('integration_type', 'slack')
      .single();

    const integrationData = {
      organization_id: organizationId,
      integration_type: 'slack',
      access_token_encrypted: encryptedToken,
      bot_user_id: tokenResponse.bot_user_id,
      team_id: tokenResponse.team.id,
      team_name: tokenResponse.team.name,
      config: {
        default_channel: null,
        notifications: {
          task_assigned: { enabled: true },
          project_created: { enabled: true },
          comment_created: { enabled: false },
          workflow_triggered: { enabled: true },
        },
        user_mapping: {
          auto_match_by_email: true,
        },
      },
      is_active: true,
      connected_by: userData.id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing integration
      const { error: updateError } = await adminClient
        .from('organization_integrations')
        .update({
          ...integrationData,
          // Don't overwrite existing config if reconnecting
          config: undefined,
        })
        .eq('id', existing.id);

      if (updateError) {
        logger.error('[Slack Callback] Failed to update integration:', updateError);
        return NextResponse.redirect(
          `${settingsUrl}?slack_error=database_error`
        );
      }

      // Update token and team info specifically
      await adminClient
        .from('organization_integrations')
        .update({
          access_token_encrypted: encryptedToken,
          bot_user_id: tokenResponse.bot_user_id,
          team_id: tokenResponse.team.id,
          team_name: tokenResponse.team.name,
          is_active: true,
          connected_by: userData.id,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new integration
      const { error: insertError } = await adminClient
        .from('organization_integrations')
        .insert(integrationData);

      if (insertError) {
        logger.error('[Slack Callback] Failed to create integration:', insertError);
        return NextResponse.redirect(
          `${settingsUrl}?slack_error=database_error`
        );
      }
    }

    logger.info('[Slack Callback] Successfully connected Slack', {
      organizationId,
      teamId: tokenResponse.team.id,
      teamName: tokenResponse.team.name,
    });

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${settingsUrl}?slack_success=true&slack_team=${encodeURIComponent(tokenResponse.team.name)}`
    );
  } catch (error) {
    logger.error('Error in GET /api/integrations/slack/callback:', error);
    return NextResponse.redirect(
      `${settingsUrl}?slack_error=unknown_error`
    );
  }
}
