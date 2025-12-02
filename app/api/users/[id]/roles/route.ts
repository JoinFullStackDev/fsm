import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireCompanyAdmin } from '@/lib/companyAdmin';
import { unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/utils/apiErrors';
import {
  getUserCustomRoles,
  assignRoleToUser,
  removeRoleFromUser,
} from '@/lib/organizationRoles';
import { getUserRoles } from '@/lib/rbac';
import logger from '@/lib/utils/logger';

// GET - Get all roles assigned to a user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: requesterId, organizationId } = await requireCompanyAdmin(request);
    
    const supabase = await createServerSupabaseClient();
    
    // Verify user exists and belongs to same organization
    const adminClient = createAdminSupabaseClient();
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('id', params.id)
      .single();

    if (userError || !user) {
      return notFound('User not found');
    }

    if (user.organization_id !== organizationId) {
      return forbidden('User does not belong to your organization');
    }

    // Get all roles (primary + custom)
    const roles = await getUserRoles(supabase, params.id, organizationId);

    return NextResponse.json({ roles });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    logger.error('[User Roles] Error fetching user roles:', error);
    return internalError('Failed to fetch user roles');
  }
}

// POST - Assign custom role to user
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: requesterId, organizationId } = await requireCompanyAdmin(request);
    
    const body = await request.json();
    const { role_id } = body;

    if (!role_id || typeof role_id !== 'string') {
      return badRequest('role_id is required');
    }

    const supabase = await createServerSupabaseClient();
    
    // Verify user exists and belongs to same organization
    const adminClient = createAdminSupabaseClient();
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('id', params.id)
      .single();

    if (userError || !user) {
      return notFound('User not found');
    }

    if (user.organization_id !== organizationId) {
      return forbidden('User does not belong to your organization');
    }

    // Verify role exists and belongs to organization
    const { data: role, error: roleError } = await adminClient
      .from('organization_roles')
      .select('id, organization_id, is_default')
      .eq('id', role_id)
      .single();

    if (roleError || !role) {
      return notFound('Role not found');
    }

    if (role.organization_id !== organizationId) {
      return forbidden('Role does not belong to your organization');
    }

    // Assign role
    await assignRoleToUser(adminClient, params.id, role_id, organizationId);

    logger.info('[User Roles] Role assigned to user:', {
      userId: params.id,
      roleId: role_id,
      organizationId,
      requesterId,
    });

    // Return updated roles
    const roles = await getUserRoles(supabase, params.id, organizationId);

    return NextResponse.json({ roles }, { status: 201 });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    
    if (error.message) {
      if (error.message.includes('does not belong')) {
        return forbidden(error.message);
      }
    }

    logger.error('[User Roles] Error assigning role:', error);
    return internalError('Failed to assign role');
  }
}

// DELETE - Remove custom role from user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: requesterId, organizationId } = await requireCompanyAdmin(request);
    
    const searchParams = request.nextUrl.searchParams;
    const role_id = searchParams.get('role_id');

    if (!role_id) {
      return badRequest('role_id query parameter is required');
    }

    const supabase = await createServerSupabaseClient();
    
    // Verify user exists and belongs to same organization
    const adminClient = createAdminSupabaseClient();
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('id', params.id)
      .single();

    if (userError || !user) {
      return notFound('User not found');
    }

    if (user.organization_id !== organizationId) {
      return forbidden('User does not belong to your organization');
    }

    // Verify role exists and belongs to organization
    const { data: role, error: roleError } = await adminClient
      .from('organization_roles')
      .select('id, organization_id')
      .eq('id', role_id)
      .single();

    if (roleError || !role) {
      return notFound('Role not found');
    }

    if (role.organization_id !== organizationId) {
      return forbidden('Role does not belong to your organization');
    }

    // Remove role
    await removeRoleFromUser(adminClient, params.id, role_id);

    logger.info('[User Roles] Role removed from user:', {
      userId: params.id,
      roleId: role_id,
      organizationId,
      requesterId,
    });

    // Return updated roles
    const roles = await getUserRoles(supabase, params.id, organizationId);

    return NextResponse.json({ roles });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return error;
    }
    
    if (error.message) {
      if (error.message.includes('does not belong')) {
        return forbidden(error.message);
      }
    }

    logger.error('[User Roles] Error removing role:', error);
    return internalError('Failed to remove role');
  }
}

