import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/users/[id]
 * Get a single user by ID (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: user, error: userError } = await adminClient
      .from('users')
      .select(`
        *,
        organizations (
          id,
          name,
          slug,
          subscription_status
        )
      `)
      .eq('id', params.id)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return notFound('User not found');
      }
      logger.error('Error fetching user:', userError);
      return internalError('Failed to fetch user', { error: userError.message });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in GET /api/global/admin/users/[id]:', error);
    return internalError('Failed to fetch user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/global/admin/users/[id]
 * Update a user (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();

    const { name, email, role, organization_id, is_active } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (organization_id !== undefined) updates.organization_id = organization_id;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: user, error: updateError } = await adminClient
      .from('users')
      .update(updates)
      .eq('id', params.id)
      .select(`
        *,
        organizations (
          id,
          name,
          slug,
          subscription_status
        )
      `)
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return notFound('User not found');
      }
      logger.error('Error updating user:', updateError);
      return internalError('Failed to update user', { error: updateError.message });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in PUT /api/global/admin/users/[id]:', error);
    return internalError('Failed to update user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

