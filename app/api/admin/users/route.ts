import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { canAddUser } from '@/lib/packageLimits';
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
    const adminClient = createAdminSupabaseClient();
    const { data: currentUser, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    // Get user's organization - use organization_id from currentUser (already fetched with admin client)
    const organizationId = currentUser.organization_id;
    if (!organizationId) {
      logger.warn('[Admin Users] User has no organization_id:', { userId: currentUser.id, authId: session.user.id });
      return badRequest('User is not assigned to an organization');
    }

    // Build query - ALWAYS filter by organization (even super admins in /admin should only see their org's users)
    // Super admins can use /global/admin for cross-organization access
    const query = adminClient
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    const { data: users, error: usersError } = await query;

    if (usersError) {
      logger.error('[Admin Users] Error fetching users:', usersError);
      return internalError('Failed to fetch users', { error: usersError.message });
    }

    // SAFETY CHECK: Double-check that all returned users belong to the organization
    const filteredUsers = (users || []).filter((user: any) => user.organization_id === organizationId);
    if (filteredUsers.length !== (users || []).length) {
      logger.error('[Admin Users] CRITICAL: Query returned users from other organizations!', {
        organizationId,
        expectedCount: users?.length || 0,
        filteredCount: filteredUsers.length,
        userId: currentUser.id
      });
    }

    logger.info('[Admin Users] Returning users for organization', {
      organizationId,
      count: filteredUsers.length,
      userId: currentUser.id
    });

    return NextResponse.json({ users: filteredUsers }, { status: 200 });
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
    const adminClient = createAdminSupabaseClient();
    const { data: currentUser, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check subscription limits (super admins still need to respect limits in org dashboard)
    const limitCheck = await canAddUser(supabase, organizationId);
    if (!limitCheck.allowed) {
      return forbidden(limitCheck.reason || 'User limit reached');
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
          organization_id: organizationId, // Assign to current user's organization
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
          organization_id: organizationId, // Assign to current user's organization
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

