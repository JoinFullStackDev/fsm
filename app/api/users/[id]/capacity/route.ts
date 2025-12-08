import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { UserCapacity } from '@/types/project';

export const dynamic = 'force-dynamic';

// GET - Get user capacity
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view user capacity');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Get user record
    const { data: currentUserData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!currentUserData) {
      return notFound('User not found');
    }

    // Check if user is viewing their own capacity or is admin/pm
    const isViewingSelf = currentUserData.id === params.id;
    const isAdmin = currentUserData.role === 'admin';
    const isPM = currentUserData.role === 'pm';

    if (!isViewingSelf && !isAdmin && !isPM) {
      return forbidden('You can only view your own capacity or must be an admin/PM');
    }

    // Get capacity
    const { data: capacity, error: capacityError } = await adminClient
      .from('user_capacity')
      .select('*')
      .eq('user_id', params.id)
      .single();

    if (capacityError && capacityError.code !== 'PGRST116') {
      logger.error('[User Capacity GET] Error loading capacity:', capacityError);
      return internalError('Failed to load user capacity', { error: capacityError.message });
    }

    // If no capacity record exists, return defaults
    if (!capacity) {
      return NextResponse.json({
        id: null,
        user_id: params.id,
        default_hours_per_week: 40.0,
        max_hours_per_week: 50.0,
        is_active: true,
        notes: null,
        created_at: null,
        updated_at: null,
      });
    }

    return NextResponse.json(capacity);
  } catch (error) {
    logger.error('[User Capacity GET] Unexpected error:', error);
    return internalError('Failed to load user capacity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// PUT - Update user capacity
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to update user capacity');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Get user record
    const { data: currentUserData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!currentUserData) {
      return notFound('User not found');
    }

    // Check permissions - users can update their own, admins can update anyone
    const isViewingSelf = currentUserData.id === params.id;
    const isAdmin = currentUserData.role === 'admin';

    if (!isViewingSelf && !isAdmin) {
      return forbidden('Only admins can update other users\' capacity');
    }

    const body = await request.json();
    const {
      default_hours_per_week,
      max_hours_per_week,
      is_active,
      notes,
    } = body;

    if (default_hours_per_week !== undefined && (default_hours_per_week <= 0 || default_hours_per_week > 168)) {
      return badRequest('default_hours_per_week must be between 0 and 168');
    }

    if (max_hours_per_week !== undefined && (max_hours_per_week <= 0 || max_hours_per_week > 168)) {
      return badRequest('max_hours_per_week must be between 0 and 168');
    }

    if (default_hours_per_week !== undefined && max_hours_per_week !== undefined && default_hours_per_week > max_hours_per_week) {
      return badRequest('default_hours_per_week cannot exceed max_hours_per_week');
    }

    // Check if capacity record exists
    const { data: existingCapacity } = await adminClient
      .from('user_capacity')
      .select('id')
      .eq('user_id', params.id)
      .single();

    let capacity: UserCapacity;

    if (existingCapacity) {
      // Update existing
      const updateData: {
        default_hours_per_week?: number;
        max_hours_per_week?: number;
        is_active?: boolean;
        notes?: string | null;
      } = {};
      if (default_hours_per_week !== undefined) updateData.default_hours_per_week = default_hours_per_week;
      if (max_hours_per_week !== undefined) updateData.max_hours_per_week = max_hours_per_week;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (notes !== undefined) updateData.notes = notes;

      const { data: updatedCapacity, error: updateError } = await adminClient
        .from('user_capacity')
        .update(updateData)
        .eq('id', existingCapacity.id)
        .select()
        .single();

      if (updateError) {
        logger.error('[User Capacity PUT] Error updating capacity:', updateError);
        return internalError('Failed to update user capacity', { error: updateError.message });
      }

      capacity = updatedCapacity;
    } else {
      // Create new
      const { data: newCapacity, error: createError } = await adminClient
        .from('user_capacity')
        .insert({
          user_id: params.id,
          default_hours_per_week: default_hours_per_week || 40.0,
          max_hours_per_week: max_hours_per_week || 50.0,
          is_active: is_active !== undefined ? is_active : true,
          notes: notes || null,
        })
        .select()
        .single();

      if (createError) {
        logger.error('[User Capacity PUT] Error creating capacity:', createError);
        return internalError('Failed to create user capacity', { error: createError.message });
      }

      capacity = newCapacity;
    }

    return NextResponse.json(capacity);
  } catch (error) {
    logger.error('[User Capacity PUT] Unexpected error:', error);
    return internalError('Failed to update user capacity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

