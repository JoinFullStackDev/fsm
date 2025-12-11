import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Type for allocation update data
interface AllocationUpdateData {
  allocated_hours_per_week?: number;
  start_date?: string;
  end_date?: string;
  notes?: string | null;
}

export const dynamic = 'force-dynamic';

// PUT - Update a resource allocation
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; allocationId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to update resource allocations');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify project access
    const { data: project } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (!project) {
      return notFound('Project not found');
    }

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Check permissions
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';
    
    if (!isSuperAdmin && !isProjectOwner && !isAdmin && !isPM) {
      return forbidden('Only project owners, admins, or PMs can update resource allocations');
    }

    // Verify allocation exists
    const { data: existingAllocation } = await adminClient
      .from('project_member_allocations')
      .select('id, user_id, project_id, allocated_hours_per_week, start_date, end_date')
      .eq('id', params.allocationId)
      .eq('project_id', params.id)
      .single();

    if (!existingAllocation) {
      return notFound('Resource allocation not found');
    }

    const body = await request.json();
    const {
      allocated_hours_per_week,
      start_date,
      end_date,
      notes,
    } = body;

    // Build update object
    const updateData: AllocationUpdateData = {};
    if (allocated_hours_per_week !== undefined) {
      if (allocated_hours_per_week <= 0) {
        return badRequest('allocated_hours_per_week must be greater than 0');
      }
      updateData.allocated_hours_per_week = allocated_hours_per_week;
    }
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (notes !== undefined) updateData.notes = notes;

    // Validate dates if both are provided
    if (updateData.start_date && updateData.end_date) {
      if (new Date(updateData.end_date) < new Date(updateData.start_date)) {
        return badRequest('end_date must be after start_date');
      }
    }

    // Check for conflicts if hours or dates are changing
    if (updateData.allocated_hours_per_week || updateData.start_date !== undefined || updateData.end_date !== undefined) {
      const finalStartDate = updateData.start_date !== undefined ? updateData.start_date : existingAllocation.start_date;
      const finalEndDate = updateData.end_date !== undefined ? updateData.end_date : existingAllocation.end_date;
      const finalHours = updateData.allocated_hours_per_week || existingAllocation.allocated_hours_per_week;

      // Get other allocations for this user
      let otherAllocationsQuery = adminClient
        .from('project_member_allocations')
        .select('id, allocated_hours_per_week, start_date, end_date')
        .eq('user_id', existingAllocation.user_id)
        .neq('id', params.allocationId);

      if (finalStartDate && finalEndDate) {
        // Both dates provided - check for overlaps
        otherAllocationsQuery = otherAllocationsQuery.or(
          `start_date.is.null,end_date.is.null,start_date.lte.${finalEndDate},end_date.gte.${finalStartDate}`
        );
      } else {
        // No dates or partial dates - check for any ongoing allocations (NULL dates)
        otherAllocationsQuery = otherAllocationsQuery.or('start_date.is.null,end_date.is.null');
      }

      const { data: otherAllocations } = await otherAllocationsQuery;

      // Check capacity
      const { data: userCapacity } = await adminClient
        .from('user_capacity')
        .select('max_hours_per_week')
        .eq('user_id', existingAllocation.user_id)
        .eq('is_active', true)
        .single();

      const maxHours = userCapacity?.max_hours_per_week || 40.0;
      
      // Calculate total allocation
      let totalAllocation = finalHours;
      if (otherAllocations) {
        for (const alloc of otherAllocations) {
          // If allocation has no dates, it's ongoing and always overlaps
          if (!alloc.start_date || !alloc.end_date) {
            totalAllocation += alloc.allocated_hours_per_week;
          } else if (finalStartDate && finalEndDate) {
            // Both current and existing have dates - check for overlap
            if (
              (new Date(alloc.start_date) <= new Date(finalEndDate)) &&
              (new Date(alloc.end_date) >= new Date(finalStartDate))
            ) {
              totalAllocation += alloc.allocated_hours_per_week;
            }
          } else {
            // Current allocation has no dates (ongoing) - overlaps with any dated allocation
            totalAllocation += alloc.allocated_hours_per_week;
          }
        }
      }

      if (totalAllocation > maxHours) {
        return badRequest(
          `Allocation would exceed user's maximum capacity of ${maxHours} hours/week. ` +
          `Total allocation: ${totalAllocation} hours/week`
        );
      }
    }

    // Update allocation
    const { data: updatedAllocation, error: updateError } = await adminClient
      .from('project_member_allocations')
      .update(updateData)
      .eq('id', params.allocationId)
      .select(`
        *,
        user:users!project_member_allocations_user_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (updateError) {
      logger.error('[Resource Allocation PUT] Error updating allocation:', updateError);
      return internalError('Failed to update resource allocation', { error: updateError.message });
    }

    return NextResponse.json(updatedAllocation);
  } catch (error) {
    logger.error('[Resource Allocation PUT] Unexpected error:', error);
    return internalError('Failed to update resource allocation', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// DELETE - Delete a resource allocation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; allocationId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to delete resource allocations');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify project access
    const { data: project } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (!project) {
      return notFound('Project not found');
    }

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Check permissions
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';
    
    if (!isSuperAdmin && !isProjectOwner && !isAdmin && !isPM) {
      return forbidden('Only project owners, admins, or PMs can delete resource allocations');
    }

    // Verify allocation exists
    const { data: existingAllocation } = await adminClient
      .from('project_member_allocations')
      .select('id')
      .eq('id', params.allocationId)
      .eq('project_id', params.id)
      .single();

    if (!existingAllocation) {
      return notFound('Resource allocation not found');
    }

    // Delete allocation
    const { error: deleteError } = await adminClient
      .from('project_member_allocations')
      .delete()
      .eq('id', params.allocationId);

    if (deleteError) {
      logger.error('[Resource Allocation DELETE] Error deleting allocation:', deleteError);
      return internalError('Failed to delete resource allocation', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Resource Allocation DELETE] Unexpected error:', error);
    return internalError('Failed to delete resource allocation', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

