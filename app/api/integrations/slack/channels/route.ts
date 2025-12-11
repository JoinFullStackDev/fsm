import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getOrganizationSlackIntegration, listChannels } from '@/lib/slackService';
import { unauthorized, forbidden, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/slack/channels
 * List available Slack channels for organization's connected workspace
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

    // Get Slack integration
    const integration = await getOrganizationSlackIntegration(organizationId);
    if (!integration) {
      return notFound('No Slack integration found. Please connect Slack first.');
    }

    // Fetch channels from Slack
    const channels = await listChannels(integration.accessToken, {
      excludeArchived: true,
      limit: 500,
    });

    // Filter to channels the bot is a member of (for private channels)
    // and all public channels
    const accessibleChannels = channels.filter(
      (ch) => !ch.is_private || ch.is_member
    );

    logger.debug('[Slack Channels] Fetched channels', {
      organizationId,
      total: channels.length,
      accessible: accessibleChannels.length,
    });

    return NextResponse.json({
      channels: accessibleChannels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        num_members: ch.num_members,
      })),
      teamName: integration.teamName,
    });
  } catch (error) {
    logger.error('Error in GET /api/integrations/slack/channels:', error);
    return internalError('Failed to list Slack channels', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
