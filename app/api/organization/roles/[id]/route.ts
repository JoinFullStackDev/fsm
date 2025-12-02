import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireCompanyAdmin } from '@/lib/companyAdmin';
import { unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/utils/apiErrors';
import {
  getRole,
  updateRole,
  deleteRole,
} from '@/lib/organizationRoles';
import logger from '@/lib/utils/logger';

// GET - Get role details with permissions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, organizationId } = await requireCompanyAdmin(request);
    
    const supabase = await createServerSupabaseClient();
    const role = await getRole(supabase, params.id);

    if (!role) {
      return notFound('Role not found');
    }

    // Verify role belongs to organization
    if (role.organization_id !== organizationId) {
      return forbidden('Role does not belong to your organization');
    }

    return NextResponse.json({ role });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    logger.error('[Organization Roles] Error fetching role:', error);
    return internalError('Failed to fetch role');
  }
}

// PUT - Update role name, description, and permissions
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
      return forbidden('Cannot modify default roles');
    }

    const body = await request.json();
    const { name, description } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Role name is required');
    }

    if (name.trim().length > 100) {
      return badRequest('Role name must be 100 characters or less');
    }

    // Use admin client for writes
    const adminClient = createAdminSupabaseClient();
    const updatedRole = await updateRole(
      adminClient,
      params.id,
      name.trim(),
      description?.trim() || null
    );

    if (!updatedRole) {
      return internalError('Failed to update role');
    }

    logger.info('[Organization Roles] Role updated:', {
      roleId: params.id,
      name: updatedRole.name,
      organizationId,
      userId,
    });

    return NextResponse.json({ role: updatedRole });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    
    if (error.message) {
      if (error.message.includes('already exists')) {
        return badRequest(error.message);
      }
      if (error.message.includes('Cannot modify')) {
        return forbidden(error.message);
      }
    }

    logger.error('[Organization Roles] Error updating role:', error);
    return internalError('Failed to update role');
  }
}

// DELETE - Delete custom role
export async function DELETE(
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
      return forbidden('Cannot delete default roles');
    }

    // Use admin client for writes
    const adminClient = createAdminSupabaseClient();
    await deleteRole(adminClient, params.id);

    logger.info('[Organization Roles] Role deleted:', {
      roleId: params.id,
      organizationId,
      userId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    
    if (error.message) {
      if (error.message.includes('Cannot delete')) {
        return forbidden(error.message);
      }
      if (error.message.includes('user(s) are assigned')) {
        return badRequest(error.message);
      }
    }

    logger.error('[Organization Roles] Error deleting role:', error);
    return internalError('Failed to delete role');
  }
}

