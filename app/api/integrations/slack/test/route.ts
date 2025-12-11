import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getOrganizationSlackIntegration, postMessage, testConnection } from '@/lib/slackService';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/slack/test
 * Send a test message to verify Slack integration
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
      .select('role, name')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return forbidden('Only organization admins can test Slack integration');
    }

    // Get Slack integration
    const integration = await getOrganizationSlackIntegration(organizationId);
    if (!integration) {
      return notFound('No Slack integration found. Please connect Slack first.');
    }

    // Parse request body
    const body = await request.json();
    const { channel } = body;

    if (!channel) {
      return badRequest('Channel is required');
    }

    // First, test the connection
    const connectionTest = await testConnection(integration.accessToken);
    if (!connectionTest.ok) {
      logger.error('[Slack Test] Connection test failed:', connectionTest.error);
      return NextResponse.json({
        success: false,
        error: `Connection test failed: ${connectionTest.error}`,
      });
    }

    // Send test message
    const result = await postMessage(
      integration.accessToken,
      channel,
      `:wave: Hello from FSM! This is a test message sent by ${userData.name || 'an admin'}.`,
      {
        username: 'FSM Bot',
        iconEmoji: ':rocket:',
      }
    );

    if (!result) {
      logger.error('[Slack Test] Failed to send test message');
      return NextResponse.json({
        success: false,
        error: 'Failed to send test message. Make sure the bot has access to the selected channel.',
      });
    }

    logger.info('[Slack Test] Test message sent successfully', {
      organizationId,
      channel,
      messageTs: result.ts,
    });

    return NextResponse.json({
      success: true,
      message: 'Test message sent successfully',
      channel: result.channel,
      timestamp: result.ts,
    });
  } catch (error) {
    logger.error('Error in POST /api/integrations/slack/test:', error);
    return internalError('Failed to send test message', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
