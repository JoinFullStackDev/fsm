import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ResourceAllocationConflict } from '@/types/project';

export const dynamic = 'force-dynamic';

// POST - Check for resource allocation conflicts
// Can check single or multiple allocations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to check allocation conflicts');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    const body = await request.json();
    const {
      allocations, // Array of allocations to check, or single allocation object
      exclude_allocation_id, // Optional: exclude this allocation from conflict check (for updates)
    } = body;

    // Support both single allocation and array of allocations
    const allocationsToCheck = Array.isArray(allocations) ? allocations : [allocations];

    if (!allocationsToCheck || allocationsToCheck.length === 0) {
      return badRequest('allocations array or single allocation object is required');
    }

    const allConflicts: ResourceAllocationConflict[] = [];
    const conflictResults = [];

    // Check each allocation
    for (const allocation of allocationsToCheck) {
      const {
        user_id,
        allocated_hours_per_week,
        start_date,
        end_date,
      } = allocation;

      if (!user_id || !allocated_hours_per_week || !start_date || !end_date) {
        conflictResults.push({
          allocation,
          has_conflicts: false,
          error: 'Missing required fields: user_id, allocated_hours_per_week, start_date, end_date',
        });
        continue;
      }

      // Get user capacity
      const { data: userCapacity } = await adminClient
        .from('user_capacity')
        .select('max_hours_per_week, default_hours_per_week')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .single();

      const maxHours = userCapacity?.max_hours_per_week || 40.0;

      // Get existing allocations for this user in the date range
      let query = adminClient
        .from('project_member_allocations')
        .select(`
          id,
          project_id,
          allocated_hours_per_week,
          start_date,
          end_date,
          project:projects!project_member_allocations_project_id_fkey(id, name)
        `)
        .eq('user_id', user_id)
        .lte('start_date', end_date)
        .gte('end_date', start_date);

      // Exclude specific allocation if updating
      if (exclude_allocation_id) {
        query = query.neq('id', exclude_allocation_id);
      }

      const { data: existingAllocations, error: allocError } = await query;

      if (allocError) {
        logger.error('[Check Conflicts] Error checking allocations:', allocError);
        conflictResults.push({
          allocation,
          has_conflicts: false,
          error: 'Failed to check conflicts',
        });
        continue;
      }

      // Calculate total allocation
      let totalAllocation = allocated_hours_per_week;
      const conflicts: ResourceAllocationConflict[] = [];

      if (existingAllocations && existingAllocations.length > 0) {
        for (const alloc of existingAllocations) {
          // Check for date overlap
          if (
            (new Date(alloc.start_date) <= new Date(end_date)) &&
            (new Date(alloc.end_date) >= new Date(start_date))
          ) {
            totalAllocation += alloc.allocated_hours_per_week;
          }
        }
      }

      // Check if over-allocated
      if (totalAllocation > maxHours) {
        const { data: userInfo } = await adminClient
          .from('users')
          .select('id, name, email')
          .eq('id', user_id)
          .single();

        conflicts.push({
          user_id,
          user_name: userInfo?.name || userInfo?.email || 'Unknown User',
          conflict_type: 'over_allocated',
          message: `Allocation would exceed user's maximum capacity of ${maxHours} hours/week`,
          current_allocation: totalAllocation - allocated_hours_per_week,
          max_capacity: maxHours,
          conflicting_projects: (existingAllocations as Array<{ project_id: string; allocated_hours_per_week: number; project?: Array<{ id: string; name: string }> | { id: string; name: string } | null }> | null)?.map((alloc) => {
            const projectData = Array.isArray(alloc.project) ? alloc.project[0] : alloc.project;
            return {
              project_id: alloc.project_id,
              project_name: projectData?.name || 'Unknown Project',
              allocated_hours: alloc.allocated_hours_per_week,
            };
          }) || [],
        });
      }

      allConflicts.push(...conflicts);

      conflictResults.push({
        allocation,
        has_conflicts: conflicts.length > 0,
        conflicts,
        total_allocation: totalAllocation,
        max_capacity: maxHours,
        utilization_percentage: (totalAllocation / maxHours) * 100,
      });
    }

    // Return results - if single allocation, return single result; if array, return array
    if (!Array.isArray(allocations)) {
      return NextResponse.json(conflictResults[0]);
    }

    return NextResponse.json({
      has_conflicts: allConflicts.length > 0,
      conflicts: allConflicts,
      results: conflictResults,
    });
  } catch (error) {
    logger.error('[Check Conflicts] Unexpected error:', error);
    return internalError('Failed to check conflicts', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

