import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { sendPushNotification } from '@/lib/pushNotifications';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

/**
 * POST /api/push/test
 * Test endpoint to send a push notification to the current user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to test push notifications');
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

    // Send test notification
    const success = await sendPushNotification(
      userData.id,
      'Test Notification',
      'This is a test push notification. If you see this, push notifications are working!',
      { url: '/dashboard' }
    );

    if (!success) {
      return internalError('Failed to send test notification. Check server logs for details.');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test notification sent. Check your browser for the notification.' 
    });
  } catch (error) {
    logger.error('Error in POST /api/push/test:', error);
    return internalError('Failed to send test notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

