import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { UserWorkloadSummary } from '@/types/project';

// Types for allocation data
interface AllocationWithProject {
  project_id: string;
  allocated_hours_per_week: number;
  start_date: string | null;
  end_date: string | null;
  project?: Array<{ id: string; name: string }> | { id: string; name: string } | null;
}

export const dynamic = 'force-dynamic';

// GET - Get workload summary for users
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // If specific user requested, verify access
    if (userId && !canViewAll && userId !== userData.id) {
      return unauthorized('You can only view your own workload');
    }

    // Get users to query
    let userIds: string[] = [];
    if (userId) {
      userIds = [userId];
    } else if (canViewAll) {
      // Get all users in the organization
      const { data: orgUsers } = await adminClient
        .from('users')
        .select('id')
        .eq('organization_id', organizationId);
      
      userIds = orgUsers?.map(u => u.id) || [];
    } else {
      userIds = [userData.id];
    }

    if (userIds.length === 0) {
      return NextResponse.json({ workloads: [] });
    }

    // Get workload summaries using the database function
    const workloads: UserWorkloadSummary[] = [];
    
    for (const uid of userIds) {
      const { data: workloadData, error: workloadError } = await adminClient
        .rpc('get_user_workload_summary', {
          p_user_id: uid,
          p_start_date: startDate,
          p_end_date: endDate,
        });

      if (workloadError) {
        logger.error(`[Workload GET] Error getting workload for user ${uid}:`, workloadError);
        continue;
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
          projects: (allocations as AllocationWithProject[] | null)?.map((alloc) => {
            const projectData = Array.isArray(alloc.project) ? alloc.project[0] : alloc.project;
            return {
              project_id: alloc.project_id,
              project_name: projectData?.name || 'Unknown Project',
              allocated_hours_per_week: alloc.allocated_hours_per_week,
              start_date: alloc.start_date,
              end_date: alloc.end_date,
            };
          }) || [],
        };

        workloads.push(workload);
      }
    }

    return NextResponse.json({ workloads });
  } catch (error) {
    logger.error('[Workload GET] Unexpected error:', error);
    return internalError('Failed to load workload summaries', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

