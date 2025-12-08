import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireCompanyAdmin } from '@/lib/companyAdmin';
import { unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/utils/apiErrors';
import {
  getRole,
  updateRolePermissions,
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

// PUT - Update permissions for a role (replace all permissions)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, organizationId } = await requireCompanyAdmin(request);
    
    const supabase = await createServerSupabaseClient();
    
    // Verify role exists and belongs to organization
    const existingRole = await getRole(supabase, params.id);
    if (!existingRole) {
      return notFound('Role not found');
    }

    if (existingRole.organization_id !== organizationId) {
      return forbidden('Role does not belong to your organization');
    }

    if (existingRole.is_default) {
      return forbidden('Cannot modify permissions for default roles');
    }

    const body = await request.json();
    const { permissions } = body;

    // Validate input
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
    await updateRolePermissions(adminClient, params.id, permissions as RBACPermission[]);

    // Fetch updated role
    const updatedRole = await getRole(supabase, params.id);

    logger.info('[Organization Roles] Role permissions updated:', {
      roleId: params.id,
      permissions: permissions.length,
      organizationId,
      userId,
    });

    return NextResponse.json({ role: updatedRole });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 401 || status === 403) {
        return error as NextResponse;
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('Invalid permissions')) {
      return badRequest(errorMessage);
    }
    if (errorMessage.includes('Cannot modify')) {
      return forbidden(errorMessage);
    }

    logger.error('[Organization Roles] Error updating role permissions:', error);
    return internalError('Failed to update role permissions');
  }
}

