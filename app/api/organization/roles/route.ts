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
    const { userId, organizationId } = await requireCompanyAdmin(request);
    
    const supabase = await createServerSupabaseClient();
    const roles = await getOrganizationRoles(supabase, organizationId);

    return NextResponse.json({ roles });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error; // Already a proper error response
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
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    
    // Handle known errors from helper functions
    if (error.message) {
      if (error.message.includes('already exists')) {
        return badRequest(error.message);
      }
      if (error.message.includes('Invalid permissions')) {
        return badRequest(error.message);
      }
    }

    logger.error('[Organization Roles] Error creating role:', error);
    return internalError('Failed to create role');
  }
}

