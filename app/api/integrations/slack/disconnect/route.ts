import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getOrganizationSlackIntegration, revokeToken } from '@/lib/slackService';
import { unauthorized, forbidden, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/slack/disconnect
 * Disconnect Slack integration from organization
 */
export async function POST(request: NextRequest) {
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
      return forbidden('Only organization admins can disconnect Slack');
    }

    // Get existing integration
    const integration = await getOrganizationSlackIntegration(organizationId);
    if (!integration) {
      return notFound('No Slack integration found');
    }

    // Revoke the token in Slack (best effort)
    try {
      await revokeToken(integration.accessToken);
      logger.info('[Slack Disconnect] Token revoked in Slack', {
        organizationId,
        teamId: integration.teamId,
      });
    } catch (revokeError) {
      // Log but don't fail - token might already be invalid
      logger.warn('[Slack Disconnect] Failed to revoke token:', revokeError);
    }

    // Delete integration from database
    const adminClient = createAdminSupabaseClient();
    const { error: deleteError } = await adminClient
      .from('organization_integrations')
      .delete()
      .eq('id', integration.id);

    if (deleteError) {
      logger.error('[Slack Disconnect] Failed to delete integration:', deleteError);
      return internalError('Failed to disconnect Slack', { error: deleteError.message });
    }

    logger.info('[Slack Disconnect] Successfully disconnected Slack', {
      organizationId,
      teamId: integration.teamId,
      teamName: integration.teamName,
    });

    return NextResponse.json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  } catch (error) {
    logger.error('Error in POST /api/integrations/slack/disconnect:', error);
    return internalError('Failed to disconnect Slack', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
