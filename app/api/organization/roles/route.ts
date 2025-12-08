import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireCompanyAdmin } from '@/lib/companyAdmin';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import {
  getOrganizationRoles,
  createOrganizationRole,
} from '@/lib/organizationRoles';
import logger from '@/lib/utils/logger';
import type { Permission as RBACPermission } from '@/lib/rbac';

const VALID_PERMISSIONS: RBACPermission[] = [
  'view_all_projects',
  'manage_users',
  'create_projects',
  'edit_project',
  'delete_project',
  'edit_phases',
  'export_blueprint',
  'export_cursor',
  'manage_project_members',
];

// GET - List all roles for organization
export async function GET(request: NextRequest) {
  try {
    // Allow both company admins and super admins to access roles
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
      logger.warn('[Organization Roles] Access denied:', {
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
    
    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const roles = await getOrganizationRoles(adminClient, organizationId);

    return NextResponse.json({ roles });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 401 || status === 403) {
        return error as NextResponse;
      }
    }
    logger.error('[Organization Roles] Error fetching roles:', error);
    return internalError('Failed to fetch roles');
  }
}

// POST - Create new custom role
export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCompanyAdmin(request);
    
    const body = await request.json();
    const { name, description, permissions } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Role name is required');
    }

    if (name.trim().length > 100) {
      return badRequest('Role name must be 100 characters or less');
    }

    if (!Array.isArray(permissions)) {
      return badRequest('Permissions must be an array');
    }

    // Validate permissions
    const invalidPermissions = permissions.filter(
      (p: string) => !VALID_PERMISSIONS.includes(p as RBACPermission)
    );
    if (invalidPermissions.length > 0) {
      return badRequest(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Use admin client for writes
    const adminClient = createAdminSupabaseClient();
    const role = await createOrganizationRole(
      adminClient,
      organizationId,
      name.trim(),
      description?.trim() || null,
      permissions as RBACPermission[]
    );

    if (!role) {
      return internalError('Failed to create role');
    }

    logger.info('[Organization Roles] Role created:', {
      roleId: role.id,
      name: role.name,
      organizationId,
      userId,
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 401 || status === 403) {
        return error as NextResponse;
      }
    }
    
    // Handle known errors from helper functions
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage) {
      if (errorMessage.includes('already exists')) {
        return badRequest(errorMessage);
      }
      if (errorMessage.includes('Invalid permissions')) {
        return badRequest(errorMessage);
      }
    }

    logger.error('[Organization Roles] Error creating role:', error);
    return internalError('Failed to create role');
  }
}

