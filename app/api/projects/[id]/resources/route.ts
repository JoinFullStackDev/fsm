import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// GET - Combined endpoint: Returns allocations + SOW + workload in one call
// This reduces 3+ API calls to 1 for better performance
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view project resources');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify project access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
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

    // Check access
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;
    
    if (!isSuperAdmin && !isProjectOwner && !projectInUserOrg) {
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();
      
      if (!projectMember) {
        return forbidden('You do not have access to this project');
      }
    }

    // Get date range from query params (default to next 30 days)
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Parallel queries for better performance
    const [allocationsResult, sowsResult, membersResult] = await Promise.all([
      // Get allocations
      adminClient
        .from('project_member_allocations')
        .select(`
          *,
          user:users!project_member_allocations_user_id_fkey(id, name, email, avatar_url)
        `)
        .eq('project_id', params.id)
        .order('start_date', { ascending: true }),
      
      // Get SOWs
      adminClient
        .from('project_scope_of_work')
        .select(`
          *,
          resource_allocations:sow_resource_allocations(*)
        `)
        .eq('project_id', params.id)
        .order('version', { ascending: false }),
      
      // Get project members for workload calculation
      adminClient
        .from('project_members')
        .select('user_id')
        .eq('project_id', params.id),
    ]);

    if (allocationsResult.error) {
      logger.error('[Resources GET] Error loading allocations:', allocationsResult.error);
    }
    if (sowsResult.error) {
      logger.error('[Resources GET] Error loading SOWs:', sowsResult.error);
    }
    if (membersResult.error) {
      logger.error('[Resources GET] Error loading members:', membersResult.error);
    }

    // Types for workload data
    interface AllocationWithProject {
      project_id: string;
      allocated_hours_per_week: number;
      start_date: string | null;
      end_date: string | null;
      project?: Array<{ id: string; name: string }> | { id: string; name: string } | null;
    }

    interface WorkloadSummary {
      user_id?: string;
      total_allocated_hours?: number;
      is_over_allocated?: boolean;
      projects?: Array<{
        project_id: string;
        project_name: string;
        allocated_hours_per_week: number;
        start_date: string | null;
        end_date: string | null;
      }>;
    }

    // Get workload summaries for all project members
    const memberUserIds = membersResult.data?.map(m => m.user_id) || [];
    const workloads: WorkloadSummary[] = [];

    if (memberUserIds.length > 0) {
      // Batch get workload summaries
      const workloadPromises = memberUserIds.map(async (userId) => {
        const { data: workloadData } = await adminClient
          .rpc('get_user_workload_summary', {
            p_user_id: userId,
            p_start_date: startDate,
            p_end_date: endDate,
          });

        if (workloadData) {
          // Get project details for this user
          const { data: userAllocations } = await adminClient
            .from('project_member_allocations')
            .select(`
              project_id,
              allocated_hours_per_week,
              start_date,
              end_date,
              project:projects!project_member_allocations_project_id_fkey(id, name)
            `)
            .eq('user_id', userId)
            .lte('start_date', endDate)
            .gte('end_date', startDate);

          return {
            ...(workloadData as WorkloadSummary),
            projects: (userAllocations as AllocationWithProject[] | null)?.map((alloc) => {
              // Handle both array and object forms of nested relation
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
        }
        return null;
      });

      const workloadResults = await Promise.all(workloadPromises);
      workloads.push(...workloadResults.filter(w => w !== null));
    }

    return NextResponse.json({
      allocations: allocationsResult.data || [],
      sows: sowsResult.data || [],
      workloads,
    });
  } catch (error) {
    logger.error('[Resources GET] Unexpected error:', error);
    return internalError('Failed to load project resources', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

