import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/unifiedCache';
import logger from '@/lib/utils/logger';

/**
 * GET /api/projects/[id]/full
 * 
 * Fetches a complete project with all related data in a single request.
 * This endpoint parallelizes all data fetching for optimal performance.
 * 
 * Returns:
 * - project: Project data with owner and company info
 * - phases: Active project phases
 * - members: Project members with user details
 * - exportCount: Number of exports for this project
 * - templateFieldConfigs: Field configs grouped by phase number (if project has template)
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing project ID
 * @returns Combined project data, or error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid project ID format');
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view this project');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Projects Full API] User not found:', userError);
      return notFound('User not found');
    }

    // OPTIMIZATION: Fetch project first to validate access, then fetch all related data in parallel
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select(`
        *,
        company:companies(id, name),
        owner:users!projects_owner_id_fkey(id, name, email, avatar_url)
      `)
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      logger.error('[Projects Full API] Error fetching project:', { 
        projectId: params.id, 
        error: projectError 
      });
      return notFound('Project not found');
    }

    // Validate access: super admins can see all projects
    // For others, check if they're a project member OR project owner OR project belongs to their organization
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

    // Calculate date for upcoming tasks (30 days from now to catch more tasks)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysFromNowISO = thirtyDaysFromNow.toISOString();

    // OPTIMIZATION: Fetch all related data in parallel with Redis caching
    const [phases, members, exportCount, templateConfigs, upcomingTasks, taskCounts] = await Promise.all([
      // Fetch phases (cached)
      cacheGetOrSet(
        CACHE_KEYS.projectPhases(params.id),
        async () => {
          const { data, error } = await adminClient
            .from('project_phases')
            .select('*')
            .eq('project_id', params.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true });
          if (error) {
            logger.error('[Projects Full API] Error fetching phases:', error);
            return [];
          }
          return data || [];
        },
        CACHE_TTL.PROJECT_PHASES
      ),
      
      // Fetch members with user details and organization role (cached)
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
            logger.error('[Projects Full API] Error fetching members:', error);
            return [];
          }
          return data || [];
        },
        CACHE_TTL.PROJECT_MEMBERS
      ),
      
      // Fetch export count (not cached - quick query, always fresh)
      (async () => {
        const { count, error } = await adminClient
          .from('project_exports')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', params.id);
        if (error) {
          logger.error('[Projects Full API] Error fetching exports:', error);
          return 0;
        }
        return count || 0;
      })(),
      
      // Fetch template field configs if project has a template (cached)
      project.template_id
        ? cacheGetOrSet(
            CACHE_KEYS.projectFieldConfigs(params.id),
            async () => {
              const { data, error } = await adminClient
                .from('template_field_configs')
                .select('phase_number, field_key')
                .eq('template_id', project.template_id);
              if (error) {
                logger.error('[Projects Full API] Error fetching template configs:', error);
                return null;
              }
              return data;
            },
            CACHE_TTL.PROJECT_FIELD_CONFIGS
          )
        : Promise.resolve(null),
      
      // Fetch upcoming tasks (overdue + next 30 days, limit 5, todo/in_progress only)
      cacheGetOrSet(
        CACHE_KEYS.projectUpcomingTasks(params.id),
        async () => {
          const { data, error } = await adminClient
            .from('project_tasks')
            .select(`
              id,
              title,
              status,
              priority,
              due_date,
              assignee:users!project_tasks_assignee_id_fkey(id, name, avatar_url)
            `)
            .eq('project_id', params.id)
            .in('status', ['todo', 'in_progress'])
            .not('due_date', 'is', null)
            .lte('due_date', thirtyDaysFromNowISO)
            .order('due_date', { ascending: true })
            .limit(5);
          if (error) {
            logger.error('[Projects Full API] Error fetching upcoming tasks:', error);
            return [];
          }
          return data || [];
        },
        CACHE_TTL.PROJECT_UPCOMING_TASKS
      ),
      
      // Fetch task counts (total, completed, upcoming)
      cacheGetOrSet(
        CACHE_KEYS.projectTaskCounts(params.id),
        async () => {
          const { data: allTasks, error } = await adminClient
            .from('project_tasks')
            .select('id, status, due_date')
            .eq('project_id', params.id);
          
          if (error) {
            logger.error('[Projects Full API] Error fetching task counts:', error);
            return { total: 0, completed: 0, upcoming: 0 };
          }
          
          const tasks = allTasks || [];
          const total = tasks.length;
          const completed = tasks.filter(t => t.status === 'done').length;
          const upcoming = tasks.filter(t => 
            t.due_date && 
            t.status !== 'done' && 
            new Date(t.due_date) <= thirtyDaysFromNow
          ).length;
          
          return { total, completed, upcoming };
        },
        CACHE_TTL.PROJECT_TASK_COUNTS
      ),
    ]);

    // Group template field configs by phase number for easier consumption
    const fieldConfigsByPhase: Record<number, Array<{ field_key: string }>> = {};
    if (templateConfigs) {
      templateConfigs.forEach((config: { phase_number: number; field_key: string }) => {
        if (!fieldConfigsByPhase[config.phase_number]) {
          fieldConfigsByPhase[config.phase_number] = [];
        }
        fieldConfigsByPhase[config.phase_number].push({ field_key: config.field_key });
      });
    }

    const response = NextResponse.json({
      project: {
        ...project,
        phases: undefined, // Remove nested phases from project, they're returned separately
      },
      phases: phases || [],
      members: members || [],
      exportCount: exportCount || 0,
      fieldConfigsByPhase,
      company: project.company || null,
      upcomingTasks: upcomingTasks || [],
      taskCounts: taskCounts || { total: 0, completed: 0, upcoming: 0 },
    });
    
    // Add cache headers for browser caching
    response.headers.set('Cache-Control', 'private, max-age=10');
    return response;
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/full:', error);
    return internalError('Failed to load project data', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

