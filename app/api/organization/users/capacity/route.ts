import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { UserCapacity } from '@/types/project';

export const dynamic = 'force-dynamic';

// GET - Batch get all users' capacity in organization
// Reduces N API calls to 1 for better performance
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view user capacities');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return unauthorized('User not found');
    }

    // Check permissions - admins and PMs can view all
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';

    if (!isAdmin && !isPM) {
      return unauthorized('Only admins and PMs can view all user capacities');
    }

    // Get all users in the organization
    const { data: orgUsers, error: usersError } = await adminClient
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    if (usersError) {
      logger.error('[Organization Capacity GET] Error loading users:', usersError);
      return internalError('Failed to load users', { error: usersError.message });
    }

    if (!orgUsers || orgUsers.length === 0) {
      return NextResponse.json({ capacities: [] });
    }

    const userIds = orgUsers.map(u => u.id);

    // Batch get all capacities
    const { data: capacities, error: capacitiesError } = await adminClient
      .from('user_capacity')
      .select('*')
      .in('user_id', userIds);

    if (capacitiesError) {
      logger.error('[Organization Capacity GET] Error loading capacities:', capacitiesError);
      return internalError('Failed to load capacities', { error: capacitiesError.message });
    }

    // Create a map of user_id to capacity for quick lookup
    const capacityMap = new Map<string, UserCapacity>();
    capacities?.forEach(cap => {
      capacityMap.set(cap.user_id, cap);
    });

    // Return capacities with defaults for users without capacity records
    const result = userIds.map(userId => {
      const capacity = capacityMap.get(userId);
      if (capacity) {
        return capacity;
      }
      // Return default capacity for users without records
      return {
        id: '', // Empty string for users without capacity records
        user_id: userId,
        default_hours_per_week: 40.0,
        max_hours_per_week: 50.0,
        is_active: true,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as UserCapacity;
    });

    return NextResponse.json({ capacities: result });
  } catch (error) {
    logger.error('[Organization Capacity GET] Unexpected error:', error);
    return internalError('Failed to load user capacities', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

