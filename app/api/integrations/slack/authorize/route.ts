import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId, hasFeatureAccess } from '@/lib/organizationContext';
import { generateOAuthUrl, getSlackAppConfig } from '@/lib/slackService';
import { unauthorized, forbidden, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/slack/authorize
 * Initiate Slack OAuth flow - redirects to Slack authorization
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

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return forbidden('Only organization admins can connect Slack');
    }

    // Check if organization has Slack integration feature enabled
    const hasAccess = await hasFeatureAccess(supabase, organizationId, 'slack_integration_enabled');
    if (!hasAccess) {
      return forbidden('Slack integration is not enabled for your organization');
    }

    // Check if Slack app is configured and enabled
    const config = await getSlackAppConfig();
    if (!config) {
      return badRequest('Slack integration is not configured by the administrator');
    }

    if (!config.enabledForOrganizations) {
      return forbidden('Slack integration is currently disabled');
    }

    // Generate redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/integrations/slack/callback`;

    // Generate OAuth URL
    const oauthUrl = await generateOAuthUrl(organizationId, redirectUri);
    if (!oauthUrl) {
      return internalError('Failed to generate OAuth URL');
    }

    logger.info('[Slack Auth] Initiating OAuth flow', {
      organizationId,
      redirectUri,
    });

    // Redirect to Slack OAuth
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    logger.error('Error in GET /api/integrations/slack/authorize:', error);
    return internalError('Failed to initiate Slack authorization', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
