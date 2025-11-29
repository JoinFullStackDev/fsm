import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError, unauthorized } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 * Validate token and reset password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return badRequest('Reset token is required');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return badRequest('Password is required and must be at least 6 characters');
    }

    const adminClient = createAdminSupabaseClient();

    // Find token in database
    const { data: resetToken, error: tokenError } = await adminClient
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token.trim())
      .single();

    if (tokenError || !resetToken) {
      return unauthorized('Invalid or expired reset token');
    }

    // Check if token is used
    if (resetToken.used) {
      return unauthorized('This reset token has already been used');
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    if (expiresAt < now) {
      return unauthorized('This reset token has expired');
    }

    // Get user record
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('id, auth_id, email')
      .eq('id', resetToken.user_id)
      .single();

    if (userError || !user) {
      logger.error('[Password Reset] User not found for token:', resetToken.user_id);
      return internalError('User not found');
    }

    // Update password using Supabase Auth Admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.auth_id,
      {
        password: password,
      }
    );

    if (updateError) {
      logger.error('[Password Reset] Error updating password:', updateError);
      return internalError('Failed to reset password', { error: updateError.message });
    }

    // Mark token as used
    await adminClient
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id);

    // Invalidate all other unused tokens for this user (security best practice)
    await adminClient
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);

    logger.info('[Password Reset] Password reset successful for user:', user.email);

    return NextResponse.json({
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    logger.error('[Password Reset] Error in reset-password:', error);
    return internalError('Failed to reset password', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

