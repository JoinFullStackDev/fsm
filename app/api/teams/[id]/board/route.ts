import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Types for team board data
interface TeamMemberUser {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

interface TeamMemberRow {
  id: string;
  user_id: string;
  created_at: string;
  user?: TeamMemberUser | TeamMemberUser[] | null;
}

interface TaskProject {
  id: string;
  name: string;
  organization_id: string;
  status?: string;
}

interface TeamBoardTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
  phase_number: number | null;
  parent_task_id: string | null;
  tags: string[];
  estimated_hours: number | null;
  created_at: string;
  updated_at: string;
  project?: TaskProject | TaskProject[] | null;
}

interface ProjectMembershipRow {
  user_id: string;
  project?: TaskProject | TaskProject[] | null;
}

interface AllocationRow {
  user_id: string;
  allocated_hours_per_week: number | string;
  start_date: string | null;
  end_date: string | null;
}

interface CapacityRow {
  user_id: string;
  max_hours_per_week: number;
  default_hours_per_week: number;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams/[id]/board
 * Get aggregated team data for the team board view:
 * - Team members
 * - Tasks assigned to team members OR from projects they're part of
 * - Projects team members are part of
 * - Workload summaries
 * 
 * Query params:
 * - include_done: boolean - Include completed tasks (for Kanban view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const includeDone = searchParams.get('include_done') === 'true';

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData?.organization_id) {
      return unauthorized('User not found or no organization');
    }

    const adminClient = createAdminSupabaseClient();

    // Verify team exists and belongs to org
    const { data: team, error: teamError } = await adminClient
      .from('teams')
      .select(`
        id,
        name,
        description,
        color,
        created_at,
        team_members (
          id,
          user_id,
          created_at,
          user:users (
            id,
            name,
            email,
            avatar_url
          )
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (teamError || !team) {
      return notFound('Team not found');
    }

    // Get member user IDs and build lookup map
    const teamMembers = (team.team_members || []) as TeamMemberRow[];
    const memberUserIds = teamMembers.map(m => m.user_id);
    const memberLookup = new Map<string, TeamMemberUser>();
    teamMembers.forEach(m => {
      // Handle both single user object and array format from Supabase
      const user = Array.isArray(m.user) ? m.user[0] : m.user;
      if (user) {
        memberLookup.set(m.user_id, user);
      }
    });

    if (memberUserIds.length === 0) {
      // No members - return empty board data
      return NextResponse.json({
        team: {
          ...team,
          members: [],
          member_count: 0,
        },
        tasks: [],
        tasks_by_status: { todo: 0, in_progress: 0, review: 0, blocked: 0 },
        tasks_due_soon: [],
        projects: [],
        workloads: [],
      });
    }

    // Build task query - get tasks ASSIGNED TO team members
    // This ensures we get all tasks they're working on regardless of project membership
    let taskQuery = adminClient
      .from('project_tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        assignee_id,
        project_id,
        phase_number,
        parent_task_id,
        tags,
        estimated_hours,
        created_at,
        updated_at,
        project:projects (
          id,
          name,
          organization_id
        )
      `)
      .in('assignee_id', memberUserIds)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(500);

    // Only filter out done tasks if not requested
    if (!includeDone) {
      taskQuery = taskQuery.neq('status', 'done');
    }

    // Run all queries in parallel for better performance
    const today = new Date().toISOString().split('T')[0];
    
    const [tasksResult, projectMembershipsResult, allocationsResult, capacitiesResult] = await Promise.all([
      taskQuery,
      
      // Get all projects team members are part of (for filter dropdown)
      adminClient
        .from('project_members')
        .select(`
          user_id,
          project:projects (
            id,
            name,
            status,
            organization_id
          )
        `)
        .in('user_id', memberUserIds),
      
      // Get workload allocations
      adminClient
        .from('project_member_allocations')
        .select(`
          user_id,
          allocated_hours_per_week,
          start_date,
          end_date
        `)
        .in('user_id', memberUserIds)
        .or('end_date.is.null,end_date.gte.' + today),
      
      // Get user capacities
      adminClient
        .from('user_capacity')
        .select('user_id, max_hours_per_week, default_hours_per_week')
        .in('user_id', memberUserIds)
        .eq('is_active', true),
    ]);

    const tasks = tasksResult.data || [];
    const projectMemberships = projectMembershipsResult.data;
    const allocations = allocationsResult.data;
    const capacities = capacitiesResult.data;

    // Filter to only org tasks and add assignee info from memberLookup
    const typedTasks = tasks as TeamBoardTask[];
    
    // Helper to get project from task (handles array or object from Supabase)
    const getTaskProject = (task: TeamBoardTask): TaskProject | undefined => {
      if (Array.isArray(task.project)) return task.project[0];
      return task.project || undefined;
    };
    
    const orgTasks = typedTasks
      .filter(task => {
        const project = getTaskProject(task);
        return project?.organization_id === userData.organization_id;
      })
      .map(task => {
        // Get assignee info from member lookup
        const assigneeInfo = task.assignee_id ? memberLookup.get(task.assignee_id) : null;
        const project = getTaskProject(task);
        return {
          ...task,
          project, // Normalize to single object
          assignee: assigneeInfo ? {
            id: assigneeInfo.id,
            name: assigneeInfo.name,
            email: assigneeInfo.email,
            avatar_url: assigneeInfo.avatar_url,
          } : null,
        };
      });

    // Build projects list from both:
    // 1. Projects from project_members
    // 2. Projects from tasks (in case team member has tasks but isn't in project_members)
    const projectsMap = new Map();
    
    // Add projects from project_members
    const typedProjectMemberships = (projectMemberships || []) as ProjectMembershipRow[];
    typedProjectMemberships.forEach(pm => {
      const project = Array.isArray(pm.project) ? pm.project[0] : pm.project;
      if (project && project.organization_id === userData.organization_id) {
        projectsMap.set(project.id, project);
      }
    });
    
    // Add projects from tasks
    orgTasks.forEach(task => {
      if (task.project && !projectsMap.has(task.project.id)) {
        projectsMap.set(task.project.id, {
          id: task.project.id,
          name: task.project.name,
          status: 'active', // Default since we don't have it from task join
        });
      }
    });
    
    const uniqueProjects = Array.from(projectsMap.values());

    // Calculate workloads for each member
    const typedAllocations = (allocations || []) as AllocationRow[];
    const typedCapacities = (capacities || []) as CapacityRow[];
    
    const workloads = memberUserIds.map((userId: string) => {
      const userAllocations = typedAllocations.filter(a => a.user_id === userId);
      const userCapacity = typedCapacities.find(c => c.user_id === userId);
      
      const totalAllocated = userAllocations.reduce(
        (sum: number, a) => {
          const hours = typeof a.allocated_hours_per_week === 'string' 
            ? parseFloat(a.allocated_hours_per_week) 
            : (a.allocated_hours_per_week || 0);
          return sum + hours;
        },
        0
      );
      const maxHours = userCapacity?.max_hours_per_week || 40;
      const defaultHours = userCapacity?.default_hours_per_week || 40;
      
      return {
        user_id: userId,
        max_hours_per_week: maxHours,
        default_hours_per_week: defaultHours,
        allocated_hours_per_week: totalAllocated,
        available_hours_per_week: Math.max(0, maxHours - totalAllocated),
        utilization_percentage: maxHours > 0 ? (totalAllocated / maxHours) * 100 : 0,
        is_over_allocated: totalAllocated > maxHours,
        start_date: today,
        end_date: today,
      };
    });

    // Calculate task stats by status (excluding done for stats)
    const activeTasks = orgTasks.filter(t => t.status !== 'done');
    const tasksByStatus = {
      todo: activeTasks.filter(t => t.status === 'todo').length,
      in_progress: activeTasks.filter(t => t.status === 'in_progress').length,
      review: activeTasks.filter(t => t.status === 'review').length,
      blocked: activeTasks.filter(t => t.status === 'blocked').length,
    };

    // Tasks due soon (within 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tasksDueSoon = activeTasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= now && dueDate <= weekFromNow;
    });

    return NextResponse.json({
      team: {
        ...team,
        members: team.team_members || [],
        member_count: team.team_members?.length || 0,
      },
      tasks: orgTasks,
      tasks_by_status: tasksByStatus,
      tasks_due_soon: tasksDueSoon,
      projects: uniqueProjects,
      workloads,
    });
  } catch (error) {
    logger.error('[Teams Board API] GET error:', error);
    return internalError('Failed to load team board data');
  }
}
