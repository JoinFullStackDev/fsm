import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/users/[id]/status
 * Update user active status (company admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update user status');
    }

    // Get current user and verify admin role
    const adminClient = createAdminSupabaseClient();
    const { data: currentUser, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_company_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !currentUser) {
      return unauthorized('User not found');
    }

    // Verify user is company admin
    if (!currentUser.is_company_admin || currentUser.organization_id === null) {
      return forbidden('Company admin access required');
    }

    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return badRequest('is_active must be a boolean');
    }

    // Get the target user to verify they belong to the same organization
    const { data: targetUser, error: targetError } = await adminClient
      .from('users')
      .select('id, organization_id, invited_by_admin, last_active_at')
      .eq('id', params.id)
      .single();

    if (targetError || !targetUser) {
      return notFound('User not found');
    }

    // Verify target user belongs to the same organization
    if (targetUser.organization_id !== currentUser.organization_id) {
      return forbidden('Cannot update user from another organization');
    }

    // Check if user was invited by admin and hasn't logged in yet
    if (targetUser.invited_by_admin && !targetUser.last_active_at && is_active) {
      return badRequest('Cannot activate invited users. They must log in first to activate their account.');
    }

    // Update user status using admin client to bypass RLS
    const { data: updatedUser, error: updateError } = await adminClient
      .from('users')
      .update({ is_active })
      .eq('id', params.id)
      .eq('organization_id', currentUser.organization_id)
      .select('id, name, email, is_active')
      .single();

    if (updateError) {
      logger.error('[Admin Users Status] Error updating user status:', updateError);
      return internalError('Failed to update user status', { error: updateError.message });
    }

    logger.info('[Admin Users Status] User status updated:', {
      userId: params.id,
      isActive: is_active,
      updatedBy: currentUser.id,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    logger.error('[Admin Users Status] Unexpected error:', error);
    return internalError('Failed to update user status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

