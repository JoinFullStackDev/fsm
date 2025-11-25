import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { generateSecurePassword } from '@/lib/utils/passwordGenerator';
import { unauthorized, notFound, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { VALID_USER_ROLES } from '@/lib/constants';
import type { UserRole } from '@/types/project';

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view users');
    }

    // Get current user and verify admin role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      logger.error('[Admin Users] Error fetching users:', usersError);
      return internalError('Failed to fetch users', { error: usersError.message });
    }

    return NextResponse.json({ users: users || [] }, { status: 200 });
  } catch (error) {
    logger.error('[Admin Users] Unexpected error:', error);
    return internalError('Failed to fetch users', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create users');
    }

    // Get current user and verify admin role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    const body = await request.json();
    const { name, email, role } = body;

    // Validate input
    if (!name || !email || !role) {
      return badRequest('Missing required fields: name, email, role');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequest('Invalid email format');
    }

    // Validate role
    if (!VALID_USER_ROLES.includes(role)) {
      return badRequest(`Invalid role. Must be one of: ${VALID_USER_ROLES.join(', ')}`);
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return badRequest('User with this email already exists');
    }

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword(16);

    // Create admin client for user creation
    const adminClient = createAdminSupabaseClient();

    // Create auth user
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        name,
        role,
      },
    });

    // Wait a moment to ensure password is fully committed
    // This helps prevent timing issues where password isn't immediately available
    await new Promise(resolve => setTimeout(resolve, 500));

    if (authError || !authUser.user) {
      logger.error('[Admin Users] Error creating auth user:', authError);
      return internalError('Failed to create auth user', { error: authError?.message });
    }

    // Check if user record was auto-created by trigger
    let userRecord;
    const { data: existingUserRecord } = await adminClient
      .from('users')
      .select('*')
      .eq('auth_id', authUser.user.id)
      .single();

    if (existingUserRecord) {
      // User record was auto-created by trigger, update it with our data
      const { data: updatedUserRecord, error: updateError } = await adminClient
        .from('users')
        .update({
          name,
          role,
          is_active: false, // Inactive until they log in
          invited_by_admin: true,
          invite_created_at: new Date().toISOString(),
          invite_created_by: currentUser.id,
        })
        .eq('auth_id', authUser.user.id)
        .select()
        .single();

      if (updateError) {
        logger.error('[Admin Users] Error updating user record:', updateError);
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        return internalError('Failed to update user record', { error: updateError.message });
      }

      userRecord = updatedUserRecord;
    } else {
      // Create user record manually (trigger didn't fire or was disabled)
      const { data: newUserRecord, error: userRecordError } = await adminClient
        .from('users')
        .insert({
          auth_id: authUser.user.id,
          email,
          name,
          role,
          is_active: false, // Inactive until they log in
          invited_by_admin: true,
          invite_created_at: new Date().toISOString(),
          invite_created_by: currentUser.id,
        })
        .select()
        .single();

      if (userRecordError) {
        // If user record creation fails, try to clean up auth user
        logger.error('[Admin Users] Error creating user record:', userRecordError);
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        return internalError('Failed to create user record', { error: userRecordError.message });
      }

      userRecord = newUserRecord;
    }

    // Refresh user record to get all fields
    const { data: finalUserRecord } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userRecord.id)
      .single();

    userRecord = finalUserRecord || userRecord;

    // Return user data and temporary password
    return NextResponse.json(
      {
        user: {
          ...userRecord,
          invited_by_admin: true,
          invite_created_at: new Date().toISOString(),
          invite_created_by: currentUser.id,
          is_active: false,
        },
        temporaryPassword, // Include password so admin can share it
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[Admin Users] Unexpected error:', error);
    return internalError('Failed to create user', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

