import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { notifyProjectMemberAdded } from '@/lib/notifications';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// GET - List all members of a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view project members');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record to check access
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userDataError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userDataError || !userData) {
      return notFound('User not found');
    }

    // Get project to verify access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Verify access: super admin, project owner, project member, or org member
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;
    
    if (!isSuperAdmin && !isProjectOwner && !projectInUserOrg) {
      // Check if user is a project member
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

    // Get all project members using admin client (with caching)
    const { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache/unifiedCache');
    const membersCacheKey = CACHE_KEYS.projectMembers(params.id);
    
    const members = await cacheGetOrSet(
      membersCacheKey,
      async () => {
        const { data: membersData, error: membersError } = await adminClient
          .from('project_members')
          .select(`
            id,
            user_id,
            role,
            user:users!project_members_user_id_fkey (
              id,
              name,
              email,
              avatar_url
            )
          `)
          .eq('project_id', params.id)
          .order('created_at', { ascending: true });

        if (membersError) {
          logger.error('[Project Members GET] Error loading members:', membersError);
          throw new Error(`Failed to load project members: ${membersError.message}`);
        }

        return membersData || [];
      },
      CACHE_TTL.PROJECT_MEMBERS
    );

    const response = NextResponse.json({ members: members || [] });
    // Use shorter cache time and allow revalidation to ensure fresh data after mutations
    response.headers.set('Cache-Control', 'private, max-age=10, must-revalidate'); // 10 seconds, must revalidate
    return response;
  } catch (error) {
    logger.error('[Project Members GET] Unexpected error:', error);
    return internalError('Failed to load project members', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Add a member to a project
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to add project members');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS issues
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User not found');
    }

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return badRequest('user_id and role are required');
    }

    // Get project to verify access - use admin client
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id, name')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Verify access: super admin, project owner, project member, or org member
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;
    
    if (!isSuperAdmin && !isProjectOwner && !projectInUserOrg) {
      // Check if user is a project member
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

    // Check if user has permission to add members (owner, admin, or PM)
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';

    if (!isProjectOwner && !isAdmin && !isPM) {
      return forbidden('Only project owners, admins, or PMs can add members');
    }

    // Check if member already exists - use admin client to avoid RLS issues
    // Use .maybeSingle() instead of .single() to handle no rows gracefully
    const { data: existingMember, error: existingError } = await adminClient
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', user_id)
      .maybeSingle();

    // If there's an error (other than no rows), log it but continue
    if (existingError && existingError.code !== 'PGRST116') {
      logger.warn('[Project Member POST] Error checking existing member:', existingError);
    }

    if (existingMember) {
      return badRequest('User is already a member of this project');
    }

    // Optional: Check user capacity before adding (non-blocking warning)
    let capacityWarning = null;
    try {
      const { data: userCapacity } = await adminClient
        .from('user_capacity')
        .select('max_hours_per_week, default_hours_per_week')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .single();

      if (userCapacity) {
        // Get current allocation
        const { data: currentAllocations } = await adminClient
          .from('project_member_allocations')
          .select('allocated_hours_per_week')
          .eq('user_id', user_id)
          .gte('end_date', new Date().toISOString().split('T')[0]);

        const totalAllocated = currentAllocations?.reduce((sum, alloc) => sum + parseFloat(alloc.allocated_hours_per_week.toString()), 0) || 0;
        const utilization = (totalAllocated / userCapacity.max_hours_per_week) * 100;

        if (utilization >= 80) {
          capacityWarning = {
            message: `User is ${utilization.toFixed(1)}% utilized (${totalAllocated.toFixed(1)}/${userCapacity.max_hours_per_week} hours/week)`,
            utilization_percentage: utilization,
            is_over_allocated: totalAllocated > userCapacity.max_hours_per_week,
          };
        }
      }
    } catch (capacityError) {
      // Non-blocking - just log if capacity check fails
      logger.warn('[Project Member] Could not check user capacity:', capacityError);
    }

    // Use admin client to bypass RLS for inserting members
    // This ensures the insert works even if RLS policies have issues
    const { data: member, error: memberError } = await adminClient
      .from('project_members')
      .insert({
        project_id: params.id,
        user_id,
        role,
      })
      .select()
      .single();

    if (memberError) {
      logger.error('[Project Member] Error adding member:', memberError);
      // Check if it's a unique constraint violation (duplicate)
      if (memberError.code === '23505' || memberError.message?.includes('duplicate') || memberError.message?.includes('unique')) {
        return badRequest('User is already a member of this project');
      }
      return internalError('Failed to add project member', { error: memberError.message });
    }

    // Invalidate cache after adding member - use cacheDel to clear both Redis and in-memory
    try {
      const { cacheDel, CACHE_KEYS } = await import('@/lib/cache/unifiedCache');
      const membersCacheKey = CACHE_KEYS.projectMembers(params.id);
      await cacheDel(membersCacheKey);
    } catch (cacheError) {
      logger.warn('[Project Member] Failed to invalidate cache:', cacheError);
      // Don't fail the request if cache invalidation fails
    }

    // Get addedBy name using admin client to avoid RLS recursion
    const { data: addedBy } = await adminClient
      .from('users')
      .select('name')
      .eq('id', userData.id)
      .single();

    // Create notification for added user
    if (project && addedBy) {
      notifyProjectMemberAdded(
        user_id,
        params.id,
        project.name,
        userData.id,
        addedBy.name
      ).catch((err) => {
        logger.error('[Project Member] Error creating notification:', err);
      });
    }

    return NextResponse.json({ 
      member,
      capacity_warning: capacityWarning, // Include warning in response (non-blocking)
    }, { status: 201 });
  } catch (error) {
    logger.error('[Project Member] Unexpected error:', error);
    return internalError('Failed to add project member', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// PATCH - Update a member's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update project members');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User not found');
    }

    const body = await request.json();
    const { member_id, role } = body;

    if (!member_id || !role) {
      return badRequest('member_id and role are required');
    }

    // Verify user is project owner or admin
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id, name')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    const isOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';

    if (!isOwner && !isAdmin && !isPM) {
      return forbidden('Only project owners, admins, or PMs can update member roles');
    }

    // Verify member exists and belongs to this project
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('project_members')
      .select('id, user_id')
      .eq('id', member_id)
      .eq('project_id', params.id)
      .single();

    if (memberCheckError || !existingMember) {
      return notFound('Project member not found');
    }

    // Use admin client to bypass RLS for updating members
    const adminClient = createAdminSupabaseClient();
    const { data: updatedMember, error: updateError } = await adminClient
      .from('project_members')
      .update({ role })
      .eq('id', member_id)
      .select()
      .single();

    if (updateError) {
      logger.error('[Project Member] Error updating member role:', updateError);
      return internalError('Failed to update project member role', { error: updateError.message });
    }

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    logger.error('[Project Member] Unexpected error updating role:', error);
    return internalError('Failed to update project member role', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

