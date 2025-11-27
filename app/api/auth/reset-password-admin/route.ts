import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password-admin
 * Reset a user's password using admin client (for troubleshooting)
 * Accepts email and new password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email) {
      return badRequest('Email is required');
    }

    if (!password || password.length < 6) {
      return badRequest('Password is required and must be at least 6 characters');
    }

    const adminClient = createAdminSupabaseClient();

    // Find user by email
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      logger.error('Error listing users:', listError);
      return internalError('Failed to find user', { error: listError.message });
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      return badRequest('User with this email not found in Auth system');
    }

    // Update user password
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        password: password,
        email_confirm: true, // Also confirm email while we're at it
      }
    );

    if (updateError) {
      logger.error('Error resetting password:', updateError);
      return internalError('Failed to reset password', { error: updateError.message });
    }

    return NextResponse.json({ 
      message: 'Password reset successfully',
      email: updatedUser.user.email,
    });
  } catch (error) {
    logger.error('Error in POST /api/auth/reset-password-admin:', error);
    return internalError('Failed to reset password', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

