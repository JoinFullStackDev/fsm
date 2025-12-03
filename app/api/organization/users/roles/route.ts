import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireCompanyAdmin } from '@/lib/companyAdmin';
import { getUserRoles } from '@/lib/rbac';
import { unauthorized, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/users/roles
 * Get roles for all users in the organization (batch endpoint)
 * Returns: { [userId]: [{ id, name, isDefault }] }
 */
export async function GET(request: NextRequest) {
  try {
    // Allow both company admins and super admins to access user roles
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in');
    }

    const adminClient = createAdminSupabaseClient();
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, is_super_admin, is_company_admin, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return unauthorized('User not found');
    }

    // Check if user is company admin, super admin, or has admin role
    // Allow access if:
    // 1. is_company_admin = true (explicit company admin)
    // 2. is_super_admin = true (super admin)
    // 3. role = 'admin' AND is_super_admin = false (fallback for legacy admin users)
    const isCompanyAdmin = userData.is_company_admin === true;
    const isSuperAdmin = userData.is_super_admin === true;
    const isLegacyAdmin = userData.role === 'admin' && userData.is_super_admin === false;

    if (!isCompanyAdmin && !isSuperAdmin && !isLegacyAdmin) {
      logger.warn('[Batch User Roles] Access denied:', {
        userId: userData.id,
        role: userData.role,
        is_company_admin: userData.is_company_admin,
        is_super_admin: userData.is_super_admin,
      });
      return forbidden('Company admin or super admin access required');
    }

    if (!userData.organization_id) {
      return forbidden('User is not assigned to an organization');
    }

    const organizationId = userData.organization_id;

    // OPTIMIZED: Batch load all user roles in a single query instead of N queries
    // Get all users with their primary roles
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select('id, role')
      .eq('organization_id', organizationId);

    if (usersError) {
      logger.error('[Batch User Roles] Error fetching users:', usersError);
      return internalError('Failed to fetch users');
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ roles: {} });
    }

    const userIds = users.map(u => u.id);
    const rolesMap: Record<string, Array<{ id: string; name: string; isDefault: boolean }>> = {};

    // Initialize all users with empty roles array
    userIds.forEach(userId => {
      rolesMap[userId] = [];
    });

    // Batch load all default roles for the organization
    const { data: defaultRoles } = await adminClient
      .from('organization_roles')
      .select('id, name, is_default')
      .eq('organization_id', organizationId)
      .eq('is_default', true);

    // Create a map of role name to role object for quick lookup
    const defaultRoleMap: Record<string, { id: string; name: string; isDefault: boolean }> = {};
    defaultRoles?.forEach(role => {
      defaultRoleMap[role.name] = {
        id: role.id,
        name: role.name,
        isDefault: role.is_default,
      };
    });

    // Add primary roles to users
    users.forEach(user => {
      if (user.role && defaultRoleMap[user.role]) {
        rolesMap[user.id].push(defaultRoleMap[user.role]);
      }
    });

    // Batch load all custom roles for all users in one query
    const { data: userRoles } = await adminClient
      .from('user_organization_roles')
      .select(`
        user_id,
        role_id,
        organization_roles!inner(
          id,
          name,
          is_default
        )
      `)
      .eq('organization_id', organizationId)
      .in('user_id', userIds);

    // Add custom roles to users
    userRoles?.forEach((userRole: any) => {
      const orgRole = userRole.organization_roles;
      if (orgRole && rolesMap[userRole.user_id]) {
        rolesMap[userRole.user_id].push({
          id: orgRole.id,
          name: orgRole.name,
          isDefault: orgRole.is_default,
        });
      }
    });

    return NextResponse.json({ roles: rolesMap });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    logger.error('[Batch User Roles] Error fetching user roles:', error);
    return internalError('Failed to fetch user roles');
  }
}

