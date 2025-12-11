import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { SOWMemberWithStats } from '@/types/project';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  SOWTaskRow, 
  ProjectMemberAllocationRow, 
  SOWProjectMemberRow,
  SOWMemberUpdateData,
  UserWorkloadSummary 
} from '@/types/database';

export const dynamic = 'force-dynamic';

// Helper function to check SOW management permissions
async function checkSOWManagementPermissions(
  adminClient: SupabaseClient,
  projectId: string,
  sowId: string,
  userData: { id: string; role: string; is_super_admin?: boolean }
): Promise<{ allowed: boolean; error?: NextResponse }> {
  // Verify SOW exists and belongs to project
  const { data: sow } = await adminClient
    .from('project_scope_of_work')
    .select('id, project_id')
    .eq('id', sowId)
    .eq('project_id', projectId)
    .single();

  if (!sow) {
    return { allowed: false, error: notFound('Scope of work not found') };
  }

  // Get project
  const { data: project } = await adminClient
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return { allowed: false, error: notFound('Project not found') };
  }

  // Check permissions
  const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
  const isProjectOwner = project.owner_id === userData.id;
  const isAdmin = userData.role === 'admin';
  const isPM = userData.role === 'pm';

  if (!isSuperAdmin && !isProjectOwner && !isAdmin && !isPM) {
    return { allowed: false, error: forbidden('Only project owners, admins, or PMs can manage SOW members') };
  }

  return { allowed: true };
}

// Helper function to enrich members with task counts and workload
async function enrichMembersWithStats(
  adminClient: SupabaseClient,
  projectId: string,
  members: unknown[]
): Promise<SOWMemberWithStats[]> {
  const typedMembers = members as SOWProjectMemberRow[];
  if (!typedMembers || typedMembers.length === 0) {
    return [];
  }

  // Extract user IDs
  const memberUserIds = typedMembers
    .map(m => m.project_member?.user_id)
    .filter((id): id is string => Boolean(id));

  if (memberUserIds.length === 0) {
    return typedMembers.map(m => ({
      ...m,
      task_count: 0,
      task_count_by_status: { todo: 0, in_progress: 0, done: 0 },
      role_name: m.organization_role?.name || 'No Role Assigned',
      role_description: m.organization_role?.description || null,
    })) as SOWMemberWithStats[];
  }

  // Get task counts and estimated hours per member (assignee_id is user_id)
  const { data: tasks } = await adminClient
    .from('project_tasks')
    .select('assignee_id, status, estimated_hours')
    .eq('project_id', projectId)
    .in('assignee_id', memberUserIds)
    .neq('status', 'archived');

  // Get workload summaries with error handling
  const workloadPromises = memberUserIds.map(userId =>
    Promise.resolve(adminClient.rpc('get_user_workload_summary', {
      p_user_id: userId,
      p_start_date: new Date().toISOString().split('T')[0],
      p_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })).then(result => ({ userId, data: result.data as UserWorkloadSummary | null, error: result.error }))
      .catch((error: unknown) => ({ userId, data: null, error }))
  );

  const workloadResults = await Promise.allSettled(workloadPromises);
  const workloadsMap = new Map<string, UserWorkloadSummary>();

  workloadResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.data) {
      workloadsMap.set(memberUserIds[index], result.value.data);
    }
  });

  // Get project member allocations for this project to calculate allocation-based overwork
  // Include allocations that are active (NULL dates = ongoing, or dates that include today)
  const today = new Date().toISOString().split('T')[0];
  const { data: projectAllocations } = await adminClient
    .from('project_member_allocations')
    .select('user_id, allocated_hours_per_week')
    .eq('project_id', projectId)
    .in('user_id', memberUserIds)
    .or(`start_date.is.null,start_date.lte.${today},end_date.is.null,end_date.gte.${today}`);

  const allocationsMap = new Map<string, number>();
  (projectAllocations as ProjectMemberAllocationRow[] | null)?.forEach(alloc => {
    allocationsMap.set(alloc.user_id, alloc.allocated_hours_per_week);
  });

  // Enrich members with stats
  const typedTasks = tasks as SOWTaskRow[] | null;
  return typedMembers.map((member) => {
    const userId = member.project_member?.user_id;
    const userTasks = typedTasks?.filter(t => t.assignee_id === userId) || [];
    const taskCount = userTasks.length;
    const taskCountByStatus = {
      todo: userTasks.filter(t => t.status === 'todo').length,
      in_progress: userTasks.filter(t => t.status === 'in_progress').length,
      done: userTasks.filter(t => t.status === 'done').length,
    };

    // Calculate total estimated hours for user's tasks
    const totalEstimatedHours = userTasks.reduce((sum: number, t) => {
      const hours = typeof t.estimated_hours === 'string' ? parseFloat(t.estimated_hours) : (t.estimated_hours || 0);
      return sum + (hours || 0);
    }, 0);

    // Get allocated hours for this project
    const allocatedHoursPerWeek = allocationsMap.get(userId || '') || 0;

    // Calculate weeks until due dates to estimate if over-allocated
    // For simplicity, use average weeks (can be enhanced with actual date calculations)
    const weeksUntilDue = userTasks.length > 0 
      ? userTasks
          .filter((t): t is SOWTaskRow & { due_date: string } => t.due_date !== null)
          .map(t => {
            const daysUntilDue = Math.max(0, Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            return daysUntilDue / 7; // Convert to weeks
          })
          .reduce((avg: number, weeks: number, _idx: number, arr: number[]) => {
            return avg + (weeks / arr.length);
          }, 0) || 4 // Default to 4 weeks if no due dates
      : 4;

    // Calculate if over-allocated based on estimated hours vs allocated hours
    // If allocated hours per week * weeks < total estimated hours, they're over-allocated
    const totalAllocatedHours = allocatedHoursPerWeek * Math.max(weeksUntilDue, 1);
    const isOverAllocatedByHours = allocatedHoursPerWeek > 0 && totalEstimatedHours > totalAllocatedHours;

    const workload = workloadsMap.get(userId || '');
    // Combine workload-based overwork detection with allocation-based detection
    const isOverworked = workload?.is_over_allocated || isOverAllocatedByHours;

    // Get role name from organization_role
    const roleName = member.organization_role?.name || 'No Role Assigned';
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
  }) as SOWMemberWithStats[];
}

// GET - List all members for a SOW (with task counts and workload)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view SOW members');
    }

    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Verify project access
    const { data: project } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (!project) {
      return notFound('Project not found');
    }

    // Get SOW members with organization roles
    const { data: members, error: membersError } = await adminClient
      .from('sow_project_members')
      .select(`
        *,
        project_member:project_members!sow_project_members_project_member_id_fkey(
          id,
          user_id,
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
      `)
      .eq('sow_id', params.sowId);

    if (membersError) {
      logger.error('[SOW Members GET] Error loading members:', membersError);
      return internalError('Failed to load SOW members', { error: membersError.message });
    }

    // Enrich with task counts and workload
    const enrichedMembers = await enrichMembersWithStats(
      adminClient,
      params.id,
      members || []
    );

    return NextResponse.json({ members: enrichedMembers });
  } catch (error) {
    logger.error('[SOW Members GET] Unexpected error:', error);
    return internalError('Failed to load SOW members', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST - Add member to SOW
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to add SOW members');
    }

    const adminClient = createAdminSupabaseClient();

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
    const permCheck = await checkSOWManagementPermissions(
      adminClient,
      params.id,
      params.sowId,
      userData
    );

    if (!permCheck.allowed) {
      return permCheck.error!;
    }

    const body = await request.json();
    const { project_member_id, organization_role_id, notes } = body;

    if (!project_member_id || !organization_role_id) {
      return badRequest('project_member_id and organization_role_id are required');
    }

    // Verify project member exists and belongs to project
    const { data: projectMember } = await adminClient
      .from('project_members')
      .select('id, project_id')
      .eq('id', project_member_id)
      .eq('project_id', params.id)
      .single();

    if (!projectMember) {
      return badRequest('Project member not found or does not belong to this project');
    }

    // Verify organization role exists and belongs to same organization
    const { data: project } = await adminClient
      .from('projects')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    const { data: orgRole } = await adminClient
      .from('organization_roles')
      .select('id, organization_id')
      .eq('id', organization_role_id)
      .eq('organization_id', project?.organization_id)
      .single();

    if (!orgRole) {
      return badRequest('Organization role not found or does not belong to this organization');
    }

    // Check if member already exists in SOW
    const { data: existing } = await adminClient
      .from('sow_project_members')
      .select('id')
      .eq('sow_id', params.sowId)
      .eq('project_member_id', project_member_id)
      .single();

    if (existing) {
      return badRequest('Member is already in this SOW');
    }

    // Add member
    const { data: newMember, error: insertError } = await adminClient
      .from('sow_project_members')
      .insert({
        sow_id: params.sowId,
        project_member_id,
        organization_role_id,
        notes: notes || null,
      })
      .select(`
        *,
        project_member:project_members!sow_project_members_project_member_id_fkey(
          id,
          user_id,
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
      `)
      .single();

    if (insertError) {
      logger.error('[SOW Members POST] Error adding member:', insertError);
      return internalError('Failed to add SOW member', { error: insertError.message });
    }

    // Enrich with stats
    const enrichedMembers = await enrichMembersWithStats(
      adminClient,
      params.id,
      [newMember]
    );

    return NextResponse.json({ member: enrichedMembers[0] }, { status: 201 });
  } catch (error) {
    logger.error('[SOW Members POST] Unexpected error:', error);
    return internalError('Failed to add SOW member', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// PUT - Update member role/notes
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to update SOW members');
    }

    const adminClient = createAdminSupabaseClient();

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
    const permCheck = await checkSOWManagementPermissions(
      adminClient,
      params.id,
      params.sowId,
      userData
    );

    if (!permCheck.allowed) {
      return permCheck.error!;
    }

    const body = await request.json();
    const { memberId, organization_role_id, notes } = body;

    if (!memberId) {
      return badRequest('memberId is required');
    }

    // Verify member exists in SOW
    const { data: existingMember } = await adminClient
      .from('sow_project_members')
      .select('id')
      .eq('id', memberId)
      .eq('sow_id', params.sowId)
      .single();

    if (!existingMember) {
      return notFound('SOW member not found');
    }

    // Build update object
    const updateData: SOWMemberUpdateData = {};
    if (organization_role_id !== undefined) {
      // Verify organization role belongs to same organization
      const { data: project } = await adminClient
        .from('projects')
        .select('organization_id')
        .eq('id', params.id)
        .single();

      const { data: orgRole } = await adminClient
        .from('organization_roles')
        .select('id, organization_id')
        .eq('id', organization_role_id)
        .eq('organization_id', project?.organization_id)
        .single();

      if (!orgRole) {
        return badRequest('Organization role not found or does not belong to this organization');
      }

      updateData.organization_role_id = organization_role_id;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Update member
    const { data: updatedMember, error: updateError } = await adminClient
      .from('sow_project_members')
      .update(updateData)
      .eq('id', memberId)
      .select(`
        *,
        project_member:project_members!sow_project_members_project_member_id_fkey(
          id,
          user_id,
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
      `)
      .single();

    if (updateError) {
      logger.error('[SOW Members PUT] Error updating member:', updateError);
      return internalError('Failed to update SOW member', { error: updateError.message });
    }

    // Enrich with stats
    const enrichedMembers = await enrichMembersWithStats(
      adminClient,
      params.id,
      [updatedMember]
    );

    return NextResponse.json({ member: enrichedMembers[0] });
  } catch (error) {
    logger.error('[SOW Members PUT] Unexpected error:', error);
    return internalError('Failed to update SOW member', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DELETE - Remove member from SOW
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to remove SOW members');
    }

    const adminClient = createAdminSupabaseClient();

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
    const permCheck = await checkSOWManagementPermissions(
      adminClient,
      params.id,
      params.sowId,
      userData
    );

    if (!permCheck.allowed) {
      return permCheck.error!;
    }

    const searchParams = request.nextUrl.searchParams;
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return badRequest('memberId query parameter is required');
    }

    // Verify member exists in SOW
    const { data: existingMember } = await adminClient
      .from('sow_project_members')
      .select('id')
      .eq('id', memberId)
      .eq('sow_id', params.sowId)
      .single();

    if (!existingMember) {
      return notFound('SOW member not found');
    }

    // Delete member
    const { error: deleteError } = await adminClient
      .from('sow_project_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      logger.error('[SOW Members DELETE] Error removing member:', deleteError);
      return internalError('Failed to remove SOW member', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[SOW Members DELETE] Unexpected error:', error);
    return internalError('Failed to remove SOW member', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

