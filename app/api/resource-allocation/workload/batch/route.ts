import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { UserWorkloadSummary } from '@/types/project';

export const dynamic = 'force-dynamic';

// POST - Batch get workload for multiple users
// Reduces N API calls to 1 for better performance
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view workload summaries');
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

    // Check permissions - admins and PMs can view all, others can only view their own
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';
    const canViewAll = isAdmin || isPM;

    const body = await request.json();
    const { user_ids, start_date, end_date } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return badRequest('user_ids array is required');
    }

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // If not admin/pm, filter to only own user_id
    const userIdsToQuery = canViewAll ? user_ids : user_ids.filter(id => id === userData.id);

    if (userIdsToQuery.length === 0) {
      return unauthorized('You can only view your own workload');
    }

    // Batch get workload summaries using Promise.all for parallel execution
    const workloadPromises = userIdsToQuery.map(async (uid: string) => {
      const { data: workloadData, error: workloadError } = await adminClient
        .rpc('get_user_workload_summary', {
          p_user_id: uid,
          p_start_date: startDate,
          p_end_date: endDate,
        });

      if (workloadError) {
        logger.error(`[Workload Batch] Error getting workload for user ${uid}:`, workloadError);
        return null;
      }

      if (workloadData) {
        // Get project details for this user
        const { data: allocations } = await adminClient
          .from('project_member_allocations')
          .select(`
            project_id,
            allocated_hours_per_week,
            start_date,
            end_date,
            project:projects!project_member_allocations_project_id_fkey(id, name)
          `)
          .eq('user_id', uid)
          .lte('start_date', endDate)
          .gte('end_date', startDate);

        const workload: UserWorkloadSummary = {
          ...workloadData,
          projects: allocations?.map((alloc: any) => ({
            project_id: alloc.project_id,
            project_name: alloc.project?.name || 'Unknown Project',
            allocated_hours_per_week: alloc.allocated_hours_per_week,
            start_date: alloc.start_date,
            end_date: alloc.end_date,
          })) || [],
        };

        return workload;
      }
      return null;
    });

    const workloads = await Promise.all(workloadPromises);
    const validWorkloads = workloads.filter(w => w !== null) as UserWorkloadSummary[];

    return NextResponse.json({ workloads: validWorkloads });
  } catch (error) {
    logger.error('[Workload Batch] Unexpected error:', error);
    return internalError('Failed to load workload summaries', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

