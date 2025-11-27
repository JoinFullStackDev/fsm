import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { registerPushSubscription, unregisterPushSubscription } from '@/lib/pushNotifications';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

/**
 * POST /api/push/subscribe
 * Register a push subscription for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to subscribe to push notifications');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Parse request body
    const body = await request.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return badRequest('Missing required fields: endpoint, keys.p256dh, keys.auth');
    }

    // Register subscription
    const result = await registerPushSubscription(
      userData.id,
      {
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
      },
      userAgent || request.headers.get('user-agent') || undefined
    );

    if (!result) {
      return internalError('Failed to register push subscription');
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    logger.error('Error in POST /api/push/subscribe:', error);
    return internalError('Failed to subscribe to push notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/push/subscribe
 * Unregister a push subscription for the current user
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to unsubscribe from push notifications');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Parse request body
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return badRequest('Missing required field: endpoint');
    }

    // Unregister subscription
    const success = await unregisterPushSubscription(userData.id, endpoint);

    if (!success) {
      return internalError('Failed to unregister push subscription');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/push/subscribe:', error);
    return internalError('Failed to unsubscribe from push notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

