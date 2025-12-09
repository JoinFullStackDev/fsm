import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/unifiedCache';
import logger from '@/lib/utils/logger';

/**
 * GET /api/projects/[id]/management-data
 * 
 * Combined endpoint that returns ALL data needed for project management page in ONE call:
 * - Project details
 * - Tasks with assignee info
 * - Phase names (for display)
 * - Project members (for assignment dropdowns)
 * 
 * This consolidates 4 separate API calls into a single optimized request.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid project ID format');
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view project management');
    }

    const adminClient = createAdminSupabaseClient();

    // Get user data first to check access
    const userData = await cacheGetOrSet(
      CACHE_KEYS.userByAuthId(user.id),
      async () => {
        const { data, error } = await adminClient
          .from('users')
          .select('id, name, email, role, organization_id, is_super_admin')
          .eq('auth_id', user.id)
          .single();
        if (error) {
          logger.error('[ManagementData] User query error:', error);
          return null;
        }
        return data;
      },
      CACHE_TTL.MEDIUM
    );

    if (!userData) {
      return notFound('User not found');
    }

    // Get project to check access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, name, description, status, template_id, owner_id, organization_id, initiated_at, primary_tool')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      logger.error('[ManagementData] Project not found:', projectError);
      return notFound('Project not found');
    }

    // Check access
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isOwner = project.owner_id === userData.id;
    const sameOrg = project.organization_id === userData.organization_id;

    if (!isSuperAdmin && !isOwner && !sameOrg) {
      // Check if user is a project member
      const { data: memberData } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .maybeSingle();

      if (!memberData) {
        return forbidden('You do not have access to this project');
      }
    }

    // OPTIMIZATION: Fetch all related data in parallel with caching
    const [tasks, phases, members] = await Promise.all([
      // Tasks with assignee info (cached for 30 seconds since tasks change frequently)
      cacheGetOrSet(
        CACHE_KEYS.projectTasks(params.id),
        async () => {
          const { data, error } = await adminClient
            .from('project_tasks')
            .select(`
              *,
              assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
            `)
            .eq('project_id', params.id)
            .order('created_at', { ascending: false });
          
          if (error) {
            logger.error('[ManagementData] Tasks query error:', error);
            return [];
          }
          
          // Transform to flatten assignee
          return (data || []).map((task) => ({
            ...task,
            assignee: task.assignee || null,
          }));
        },
        CACHE_TTL.PROJECT_TASKS
      ),

      // Phase names (cached for 2 minutes)
      cacheGetOrSet(
        CACHE_KEYS.projectPhases(params.id),
        async () => {
          const { data, error } = await adminClient
            .from('project_phases')
            .select('id, phase_number, phase_name, display_order, completed')
            .eq('project_id', params.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true });
          
          if (error) {
            logger.error('[ManagementData] Phases query error:', error);
            return [];
          }
          return data || [];
        },
        CACHE_TTL.PROJECT_PHASES
      ),

      // Project members with user details (cached for 1 minute)
      cacheGetOrSet(
        CACHE_KEYS.projectMembers(params.id),
        async () => {
          const { data, error } = await adminClient
            .from('project_members')
            .select(`
              id,
              user_id,
              organization_role_id,
              created_at,
              organization_role:organization_roles (
                id,
                name,
                description
              ),
              user:users!project_members_user_id_fkey (
                id,
                name,
                email,
                avatar_url
              )
            `)
            .eq('project_id', params.id)
            .order('created_at', { ascending: true });
          
          if (error) {
            logger.error('[ManagementData] Members query error:', error);
            return [];
          }
          return data || [];
        },
        CACHE_TTL.PROJECT_MEMBERS
      ),
    ]);

    // Build task map for parent references
    const taskMap = new Map<string, typeof tasks[0]>();
    tasks.forEach((task) => {
      taskMap.set(task.id, task);
    });

    // Transform tasks to include parent task info
    const transformedTasks = tasks.map((task) => {
      const parentTask = task.parent_task_id ? taskMap.get(task.parent_task_id) : null;
      return {
        ...task,
        parent_task: parentTask ? {
          id: parentTask.id,
          title: parentTask.title,
          assignee_id: parentTask.assignee_id,
        } : null,
      };
    });

    // Build phase names map for easy lookup
    const phaseNames: Record<number, string> = {};
    (phases as Array<{ phase_number: number; phase_name: string }>).forEach((phase) => {
      if (phase.phase_number && phase.phase_name) {
        phaseNames[phase.phase_number] = phase.phase_name;
      }
    });

    // Transform members to extract user data
    // Supabase joins can return user as object or array depending on query
    const projectMembers = (members as unknown as Array<{ user: { id: string; name: string; email: string; avatar_url?: string | null } | null }>)
      .map((m) => m.user)
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
        role: 'pm' as const,
        auth_id: '',
        created_at: '',
      }));

    const responseTime = Date.now() - startTime;
    logger.debug('[ManagementData] Combined data loaded in', responseTime, 'ms');

    const response = NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        template_id: project.template_id,
        owner_id: project.owner_id,
        initiated_at: project.initiated_at,
        primary_tool: project.primary_tool,
      },
      tasks: transformedTasks,
      phases,
      phaseNames,
      members,
      projectMembers,
      currentUserId: userData.id,
      meta: {
        responseTime,
        taskCount: transformedTasks.length,
        phaseCount: phases.length,
        memberCount: members.length,
      },
    });

    // Short cache for browser
    response.headers.set('Cache-Control', 'private, max-age=5');
    return response;
  } catch (error) {
    logger.error('[ManagementData] Error:', error);
    return internalError('Failed to load project management data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

