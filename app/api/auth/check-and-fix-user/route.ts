import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/check-and-fix-user
 * Check if user exists in Auth, and create/fix if needed
 * This helps troubleshoot signup issues
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email) {
      return badRequest('Email is required');
    }

    const adminClient = createAdminSupabaseClient();

    // Check if user exists in Auth
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      logger.error('Error listing users:', listError);
      return internalError('Failed to check users', { error: listError.message });
    }

    const authUser = users.users.find(u => u.email === email);

    // Check if user exists in database
    const { data: dbUser, error: dbError } = await adminClient
      .from('users')
      .select('id, email, auth_id, name, organization_id')
      .eq('email', email)
      .maybeSingle();

    if (dbError && dbError.code !== 'PGRST116') {
      logger.error('Error checking database user:', dbError);
      return internalError('Failed to check database user', { error: dbError.message });
    }

    const result: {
      existsInAuth: boolean;
      existsInDatabase: boolean;
      authUserId: string | null;
      dbUserId: string | null;
      emailConfirmed: boolean;
      message?: string;
      action?: string;
      fixed?: boolean;
      updateError?: string;
      passwordResetError?: string;
      passwordReset?: boolean;
      createAuthUserError?: string;
      authUserCreated?: boolean;
      newAuthUserId?: string;
    } = {
      existsInAuth: !!authUser,
      existsInDatabase: !!dbUser,
      authUserId: authUser?.id || null,
      dbUserId: dbUser?.id || null,
      emailConfirmed: authUser?.email_confirmed_at ? true : false,
    };

    // If user exists in database but not in Auth, we can't auto-create them
    // because we don't have the original password
    if (dbUser && !authUser) {
      result.message = 'User exists in database but not in Auth. You need to create the Auth user manually or use the signup flow again.';
      result.action = 'User needs to sign up again or admin needs to create Auth user';
    }

    // If user exists in Auth but not in database, we can create the database record
    if (authUser && !dbUser) {
      result.message = 'User exists in Auth but not in database. This is unusual.';
    }

    // If user exists in both but auth_id doesn't match
    if (authUser && dbUser && dbUser.auth_id !== authUser.id) {
      result.message = 'User exists in both but auth_id mismatch. Updating database record...';
      const { error: updateError } = await adminClient
        .from('users')
        .update({ auth_id: authUser.id })
        .eq('id', dbUser.id);
      
      if (updateError) {
        result.updateError = updateError.message;
      } else {
        result.message = 'Database auth_id updated successfully';
      }
    }

    // If password provided and user exists in Auth, reset password
    if (password && authUser) {
      if (password.length < 6) {
        return badRequest('Password must be at least 6 characters');
      }

      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        authUser.id,
        {
          password: password,
          email_confirm: true,
        }
      );

      if (updateError) {
        result.passwordResetError = updateError.message;
      } else {
        result.passwordReset = true;
        result.message = (result.message || '') + ' Password reset successfully.';
      }
    }

    // If user doesn't exist in Auth but exists in DB, and password provided, create Auth user
    if (!authUser && dbUser && password) {
      if (password.length < 6) {
        return badRequest('Password must be at least 6 characters');
      }

      const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: dbUser.name || '',
        },
      });

      if (createError) {
        result.createAuthUserError = createError.message;
      } else {
        // Update database record with auth_id
        await adminClient
          .from('users')
          .update({ auth_id: newAuthUser.user.id })
          .eq('id', dbUser.id);

        result.authUserCreated = true;
        result.authUserId = newAuthUser.user.id;
        result.message = 'Auth user created and linked to database record.';
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in POST /api/auth/check-and-fix-user:', error);
    return internalError('Failed to check/fix user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

