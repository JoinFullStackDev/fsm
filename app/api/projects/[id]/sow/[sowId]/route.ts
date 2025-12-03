import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// GET - Get a specific SOW
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view scope of work');
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

    // Get SOW with resource allocations and project members
    const { data: sow, error: sowError } = await adminClient
      .from('project_scope_of_work')
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*),
        project_members:sow_project_members(
          *,
          project_member:project_members!sow_project_members_project_member_id_fkey(
            id,
            user_id,
            role,
            user:users!project_members_user_id_fkey(
              id,
              name,
              email
            )
          ),
          organization_role:organization_roles!sow_project_members_organization_role_id_fkey(
            id,
            name,
            description,
            organization_id
          )
        )
      `)
      .eq('id', params.sowId)
      .eq('project_id', params.id)
      .single();

    if (sowError || !sow) {
      return notFound('Scope of work not found');
    }

    // Enrich project members with task counts and workload if they exist
    if (sow.project_members && sow.project_members.length > 0) {
      const memberUserIds = sow.project_members
        .map((pm: any) => pm.project_member?.user_id)
        .filter(Boolean);

      if (memberUserIds.length > 0) {
        // Get task counts and estimated hours
        const { data: tasks } = await adminClient
          .from('project_tasks')
          .select('assignee_id, status, estimated_hours, due_date')
          .eq('project_id', params.id)
          .in('assignee_id', memberUserIds)
          .neq('status', 'archived');

        // Get project member allocations
        // Include allocations that are active (NULL dates = ongoing, or dates that include today)
        const today = new Date().toISOString().split('T')[0];
        const { data: projectAllocations } = await adminClient
          .from('project_member_allocations')
          .select('user_id, allocated_hours_per_week')
          .eq('project_id', params.id)
          .in('user_id', memberUserIds)
          .or(`start_date.is.null,start_date.lte.${today},end_date.is.null,end_date.gte.${today}`);

        const allocationsMap = new Map<string, number>();
        projectAllocations?.forEach((alloc: any) => {
          allocationsMap.set(alloc.user_id, alloc.allocated_hours_per_week);
        });

        // Get workload summaries with error handling
        const workloadPromises = memberUserIds.map(async (userId: string) => {
          try {
            const result: any = await adminClient.rpc('get_user_workload_summary', {
              p_user_id: userId,
              p_start_date: new Date().toISOString().split('T')[0],
              p_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            });
            return { userId, data: result.data, error: result.error };
          } catch (error: any) {
            return { userId, data: null, error };
          }
        });

        const workloadResults = await Promise.allSettled(workloadPromises);
        const workloadsMap = new Map<string, any>();

        workloadResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.data) {
            workloadsMap.set(memberUserIds[index], result.value.data);
          }
        });

        // Enrich members with stats
        sow.project_members = sow.project_members.map((member: any) => {
          const userId = member.project_member?.user_id;
          const userTasks = tasks?.filter((t: any) => t.assignee_id === userId) || [];
          const taskCount = userTasks.length;
          const taskCountByStatus = {
            todo: userTasks.filter((t: any) => t.status === 'todo').length,
            in_progress: userTasks.filter((t: any) => t.status === 'in_progress').length,
            done: userTasks.filter((t: any) => t.status === 'done').length,
          };

          // Calculate total estimated hours
          const totalEstimatedHours = userTasks.reduce((sum: number, t: any) => {
            return sum + (parseFloat(t.estimated_hours) || 0);
          }, 0);

          // Get allocated hours for this project
          const allocatedHoursPerWeek = allocationsMap.get(userId || '') || 0;

          // Calculate average weeks until due dates
          const weeksUntilDue = userTasks.length > 0 && userTasks.some((t: any) => t.due_date)
            ? userTasks
                .filter((t: any) => t.due_date)
                .map((t: any) => {
                  const daysUntilDue = Math.max(0, Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  return daysUntilDue / 7;
                })
                .reduce((avg: number, weeks: number, idx: number, arr: number[]) => {
                  return avg + (weeks / arr.length);
                }, 0) || 4
            : 4;

          // Check if over-allocated based on estimated hours vs allocated hours
          const totalAllocatedHours = allocatedHoursPerWeek * Math.max(weeksUntilDue, 1);
          const isOverAllocatedByHours = allocatedHoursPerWeek > 0 && totalEstimatedHours > totalAllocatedHours;

          const workload = workloadsMap.get(userId || '');
          // Combine workload-based and allocation-based overwork detection
          const isOverworked = workload?.is_over_allocated || isOverAllocatedByHours;

          // Fallback: use organization_role.name or project_member.role
          const roleName = member.organization_role?.name || member.project_member?.role || 'Unknown';
          const roleDescription = member.organization_role?.description || null;

          return {
            ...member,
            task_count: taskCount,
            task_count_by_status: taskCountByStatus,
            workload_summary: workload,
            is_overworked: isOverworked,
            role_name: roleName,
            role_description: roleDescription,
            // Add allocation-based metrics
            total_estimated_hours: totalEstimatedHours,
            allocated_hours_per_week: allocatedHoursPerWeek,
            allocation_utilization: allocatedHoursPerWeek > 0 
              ? (totalEstimatedHours / (allocatedHoursPerWeek * Math.max(weeksUntilDue, 1))) * 100 
              : 0,
          };
        });
      }
    }

    return NextResponse.json(sow);
  } catch (error) {
    logger.error('[SOW GET] Unexpected error:', error);
    return internalError('Failed to load scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// PUT - Update a SOW
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to update scope of work');
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
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('role')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();
      
      if (!projectMember || (projectMember.role !== 'admin' && projectMember.role !== 'pm')) {
        return forbidden('Only project owners, admins, or PMs can update scope of work');
      }
    }

    // Verify SOW exists
    const { data: existingSOW } = await adminClient
      .from('project_scope_of_work')
      .select('id, status')
      .eq('id', params.sowId)
      .eq('project_id', params.id)
      .single();

    if (!existingSOW) {
      return notFound('Scope of work not found');
    }

    const body = await request.json();
    const {
      title,
      description,
      objectives,
      deliverables,
      timeline,
      budget,
      assumptions,
      constraints,
      exclusions,
      acceptance_criteria,
      status,
    } = body;

    // Build update object
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (objectives !== undefined) updateData.objectives = objectives;
    if (deliverables !== undefined) updateData.deliverables = deliverables;
    if (timeline !== undefined) updateData.timeline = timeline;
    if (budget !== undefined) updateData.budget = budget;
    if (assumptions !== undefined) updateData.assumptions = assumptions;
    if (constraints !== undefined) updateData.constraints = constraints;
    if (exclusions !== undefined) updateData.exclusions = exclusions;
    if (acceptance_criteria !== undefined) updateData.acceptance_criteria = acceptance_criteria;
    if (status !== undefined) {
      updateData.status = status;
      // If approving, set approved_by and approved_at
      if (status === 'approved' && existingSOW.status !== 'approved') {
        updateData.approved_by = userData.id;
        updateData.approved_at = new Date().toISOString();
      }
    }

    const { data: updatedSOW, error: updateError } = await adminClient
      .from('project_scope_of_work')
      .update(updateData)
      .eq('id', params.sowId)
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .single();

    if (updateError) {
      logger.error('[SOW PUT] Error updating SOW:', updateError);
      return internalError('Failed to update scope of work', { error: updateError.message });
    }

    return NextResponse.json(updatedSOW);
  } catch (error) {
    logger.error('[SOW PUT] Unexpected error:', error);
    return internalError('Failed to update scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// DELETE - Delete a SOW
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to delete scope of work');
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

    // Check permissions - only owners and admins can delete
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';
    
    if (!isSuperAdmin && !isProjectOwner && !isAdmin) {
      return forbidden('Only project owners or admins can delete scope of work');
    }

    // Verify SOW exists
    const { data: existingSOW } = await adminClient
      .from('project_scope_of_work')
      .select('id')
      .eq('id', params.sowId)
      .eq('project_id', params.id)
      .single();

    if (!existingSOW) {
      return notFound('Scope of work not found');
    }

    // Delete SOW (cascade will delete resource allocations)
    const { error: deleteError } = await adminClient
      .from('project_scope_of_work')
      .delete()
      .eq('id', params.sowId);

    if (deleteError) {
      logger.error('[SOW DELETE] Error deleting SOW:', deleteError);
      return internalError('Failed to delete scope of work', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[SOW DELETE] Unexpected error:', error);
    return internalError('Failed to delete scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

