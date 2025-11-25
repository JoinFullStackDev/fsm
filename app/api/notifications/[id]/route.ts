import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// PATCH - Mark notification as read/unread
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update notifications');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    const body = await request.json();
    const { read } = body;

    if (typeof read !== 'boolean') {
      return badRequest('read must be a boolean');
    }

    // Update notification (RLS will ensure user can only update their own)
    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ read, read_at: read ? new Date().toISOString() : null })
      .eq('id', params.id)
      .eq('user_id', userData.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating notification:', error);
      return internalError('Failed to update notification', { error: error.message });
    }

    if (!notification) {
      return notFound('Notification');
    }

    return NextResponse.json({ notification });
  } catch (error) {
    logger.error('Error in PATCH /api/notifications/[id]:', error);
    return internalError('Failed to update notification', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// DELETE - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete notifications');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Delete notification (RLS will ensure user can only delete their own)
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userData.id);

    if (error) {
      logger.error('Error deleting notification:', error);
      return internalError('Failed to delete notification', { error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/notifications/[id]:', error);
    return internalError('Failed to delete notification', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

