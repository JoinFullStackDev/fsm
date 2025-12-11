import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectMemberAllocation } from '@/types/project';

export const dynamic = 'force-dynamic';

// GET - Get resource allocations for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view resource allocations');
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

    // Get allocations with user info
    const { data: allocations, error: allocationsError } = await adminClient
      .from('project_member_allocations')
      .select(`
        *,
        user:users!project_member_allocations_user_id_fkey(id, name, email, avatar_url)
      `)
      .eq('project_id', params.id)
      .order('start_date', { ascending: true });

    if (allocationsError) {
      logger.error('[Resource Allocation GET] Error loading allocations:', allocationsError);
      return internalError('Failed to load resource allocations', { error: allocationsError.message });
    }

    return NextResponse.json({ allocations: allocations || [] });
  } catch (error) {
    logger.error('[Resource Allocation GET] Unexpected error:', error);
    return internalError('Failed to load resource allocations', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create a resource allocation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to create resource allocations');
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
      return forbidden('Only project owners, admins, or PMs can create resource allocations');
    }

    const body = await request.json();
    const {
      user_id,
      allocated_hours_per_week,
      start_date,
      end_date,
      notes,
    } = body;

    if (!user_id || !allocated_hours_per_week) {
      return badRequest('user_id and allocated_hours_per_week are required');
    }

    if (allocated_hours_per_week <= 0) {
      return badRequest('allocated_hours_per_week must be greater than 0');
    }

    // Validate dates if both are provided
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return badRequest('end_date must be after start_date');
    }

    // Check for conflicts - check if user is already allocated during this period
    // If dates are provided, check for overlaps. If NULL, treat as ongoing (no end date).
    let existingAllocationsQuery = adminClient
      .from('project_member_allocations')
      .select('id, project_id, allocated_hours_per_week, start_date, end_date')
      .eq('user_id', user_id);

    if (start_date && end_date) {
      // Both dates provided - check for overlaps
      existingAllocationsQuery = existingAllocationsQuery.or(
        `start_date.is.null,end_date.is.null,start_date.lte.${end_date},end_date.gte.${start_date}`
      );
    } else {
      // No dates or partial dates - check for any ongoing allocations (NULL dates)
      existingAllocationsQuery = existingAllocationsQuery.or('start_date.is.null,end_date.is.null');
    }

    const { data: existingAllocations } = await existingAllocationsQuery;

    // Check capacity
    const { data: userCapacity } = await adminClient
      .from('user_capacity')
      .select('max_hours_per_week, default_hours_per_week')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single();

    const maxHours = userCapacity?.max_hours_per_week || 40.0;
    
    // Calculate total allocation for the period
    let totalAllocation = allocated_hours_per_week;
    if (existingAllocations) {
      for (const alloc of existingAllocations) {
        // If allocation has no dates, it's ongoing and always overlaps
        if (!alloc.start_date || !alloc.end_date) {
          totalAllocation += alloc.allocated_hours_per_week;
        } else if (start_date && end_date) {
          // Both current and existing have dates - check for overlap
          if (
            (new Date(alloc.start_date) <= new Date(end_date)) &&
            (new Date(alloc.end_date) >= new Date(start_date))
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
        `Current allocation: ${totalAllocation - allocated_hours_per_week} hours/week, ` +
        `Requested: ${allocated_hours_per_week} hours/week, ` +
        `Total: ${totalAllocation} hours/week`
      );
    }

    // Create allocation
    const { data: allocation, error: allocationError } = await adminClient
      .from('project_member_allocations')
      .insert({
        project_id: params.id,
        user_id,
        allocated_hours_per_week,
        start_date: start_date || null,
        end_date: end_date || null,
        notes: notes || null,
      })
      .select(`
        *,
        user:users!project_member_allocations_user_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (allocationError) {
      logger.error('[Resource Allocation POST] Error creating allocation:', allocationError);
      return internalError('Failed to create resource allocation', { error: allocationError.message });
    }

    return NextResponse.json(allocation, { status: 201 });
  } catch (error) {
    logger.error('[Resource Allocation POST] Unexpected error:', error);
    return internalError('Failed to create resource allocation', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

