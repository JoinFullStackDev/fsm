import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { PAGINATION_DEFAULTS } from '@/lib/constants';

// GET - Fetch user's notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view notifications');
    }

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();
    
    // Get user record using admin client
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const read = searchParams.get('read'); // 'true', 'false', or null for all
    const limit = parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULTS.LIMIT));
    const offset = parseInt(searchParams.get('offset') || String(PAGINATION_DEFAULTS.OFFSET));

    // Build query using admin client
    let query = adminClient
      .from('notifications')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by read status if provided
    if (read === 'true') {
      query = query.eq('read', true);
    } else if (read === 'false') {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      logger.error('Error loading notifications:', error);
      return internalError('Failed to load notifications', { error: error.message });
    }

    // Get unread count using admin client
    const { count: unreadCount } = await adminClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userData.id)
      .eq('read', false);

    const response = NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
    response.headers.set('Cache-Control', 'private, max-age=5'); // 5 second cache for notifications
    return response;
  } catch (error) {
    logger.error('Error in GET /api/notifications:', error);
    return internalError('Failed to load notifications', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create notification (admin/system only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to create notifications');
    }

    const body = await request.json();
    const { user_id, type, title, message, metadata } = body;

    // Validate required fields
    if (!user_id || !type || !title || !message) {
      return badRequest('Missing required fields: user_id, type, title, message');
    }

    // Get user record to verify permissions (optional: check if admin)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Check user preferences for in-app notifications
    const { data: targetUser } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', user_id)
      .single();

    // Respect user preferences - if inApp notifications are disabled, don't create
    if (targetUser?.preferences?.notifications?.inApp === false) {
      return NextResponse.json({ 
        message: 'Notification not created - user has in-app notifications disabled',
        skipped: true 
      });
    }

    // Create notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (notificationError) {
      logger.error('Error creating notification:', notificationError);
      return internalError('Failed to create notification', { error: notificationError.message });
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/notifications:', error);
    return internalError('Failed to create notification', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

