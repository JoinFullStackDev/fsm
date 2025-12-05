import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { generateTasksFromPrompt } from '@/lib/ai/taskGenerator';
import { detectDuplicates } from '@/lib/ai/taskSimilarity';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import logger from '@/lib/utils/logger';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import { getOrganizationContext, hasFeatureAccess } from '@/lib/organizationContext';
import type { PreviewGenerationRequest, PreviewGenerationResponse } from '@/types/taskGenerator';
import type { ProjectTask } from '@/types/project';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to generate tasks');
    }

    // Use admin client to bypass RLS for user and project lookups
    const adminClient = createAdminSupabaseClient();

    // OPTIMIZATION: Parallelize all initial data fetching
    const [userResult, projectResult, phasesResult, tasksResult, orgContextResult] = await Promise.all([
      // Get user record
      adminClient
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single(),
      // Get project
      adminClient
        .from('projects')
        .select('id, name, owner_id')
        .eq('id', params.id)
        .single(),
      // Get phases
      adminClient
        .from('project_phases')
        .select('phase_number, phase_name, display_order, data, completed')
        .eq('project_id', params.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      // Get existing tasks
      adminClient
        .from('project_tasks')
        .select('*')
        .eq('project_id', params.id)
        .neq('status', 'archived'),
      // Get organization context
      getOrganizationContext(supabase, user.id),
    ]);

    const { data: userData, error: userError } = userResult;
    const { data: project, error: projectError } = projectResult;
    const { data: phases, error: phasesError } = phasesResult;
    const { data: existingTasks, error: tasksError } = tasksResult;
    const orgContext = orgContextResult;

    if (userError || !userData) {
      logger.error('[Task Generator Preview] User not found:', { authId: user.id, error: userError });
      return notFound('User');
    }

    if (projectError || !project) {
      logger.error('[Task Generator Preview] Project not found:', { projectId: params.id, error: projectError });
      return notFound('Project not found');
    }

    // Check membership only if not owner
    const isOwner = project.owner_id === userData.id;
    if (!isOwner) {
      const { data: memberData } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .maybeSingle();

      if (!memberData) {
        return unauthorized('You do not have access to this project');
      }
    }

    if (!orgContext) {
      return unauthorized('Organization not found');
    }

    const hasAccess = await hasFeatureAccess(
      supabase,
      orgContext.organization.id,
      'ai_task_generator_enabled'
    );

    if (!hasAccess) {
      return unauthorized('AI Task Generator is not enabled for your organization');
    }

    // Parse request body
    const body: PreviewGenerationRequest = await request.json();
    const { prompt, context } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return badRequest('Prompt is required');
    }

    if (phasesError) {
      logger.error('[Task Generator Preview] Error loading phases:', phasesError);
      return internalError('Failed to load project phases', { error: phasesError.message });
    }

    if (!phases || phases.length === 0) {
      return badRequest('Project must have at least one phase');
    }

    if (tasksError) {
      logger.error('[Task Generator Preview] Error loading tasks:', tasksError);
      return internalError('Failed to load existing tasks', { error: tasksError.message });
    }

    // Get Gemini API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return badRequest('Gemini API key not configured. Please configure it in Admin > API Config.');
    }

    // Load active SOW with project members OR resource allocations (if exists)
    // adminClient already created above
    let sowMembers: Array<{
      user_id: string;
      name: string;
      role_name: string;
      role_description: string | null;
      current_task_count: number;
      is_overworked: boolean;
    }> = [];

    try {
      // First try to get SOW members
      const { data: activeSOW } = await adminClient
        .from('project_scope_of_work')
        .select(`
          id,
          project_members:sow_project_members(
            organization_role_id,
            project_member:project_members!sow_project_members_project_member_id_fkey(
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
              description
            )
          )
        `)
        .eq('project_id', params.id)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .single();

      let memberUserIds: string[] = [];
      let memberMap = new Map<string, { role_name: string; role_description: string | null }>();

      // If SOW exists, use SOW members
      if (activeSOW?.project_members && activeSOW.project_members.length > 0) {
        memberUserIds = activeSOW.project_members
          .map((pm: any) => pm.project_member?.user_id)
          .filter(Boolean);

        activeSOW.project_members.forEach((pm: any) => {
          const userId = pm.project_member?.user_id;
          if (userId) {
            const roleName = pm.organization_role?.name || pm.project_member?.role || 'Team Member';
            const roleDescription = pm.organization_role?.description || null;
            memberMap.set(userId, { role_name: roleName, role_description: roleDescription });
          }
        });
      } else {
        // No SOW - try to get resource allocations instead
        const today = new Date().toISOString().split('T')[0];
        const { data: allocations } = await adminClient
          .from('project_member_allocations')
          .select(`
            user_id,
            allocated_hours_per_week,
            user:users!project_member_allocations_user_id_fkey(
              id,
              name,
              email
            )
          `)
          .eq('project_id', params.id)
          .or(`start_date.is.null,start_date.lte.${today},end_date.is.null,end_date.gte.${today}`);

        if (allocations && allocations.length > 0) {
          memberUserIds = allocations.map((a: any) => a.user_id).filter(Boolean);
          
          // Get project members to get their roles
          const { data: projectMembers } = await adminClient
            .from('project_members')
            .select('user_id, role')
            .eq('project_id', params.id)
            .in('user_id', memberUserIds);

          allocations.forEach((alloc: any) => {
            const userId = alloc.user_id;
            const pm = projectMembers?.find((pm: any) => pm.user_id === userId);
            const roleName = pm?.role || 'Team Member';
            memberMap.set(userId, { role_name: roleName, role_description: null });
          });
        }
      }

      // OPTIMIZATION: Enrich with task counts, workload, and user details in parallel
      if (memberUserIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Run all enrichment queries in parallel
        const [tasksResult, usersResult, ...workloadResults] = await Promise.all([
          // Get task counts
          adminClient
            .from('project_tasks')
            .select('assignee_id, status')
            .eq('project_id', params.id)
            .in('assignee_id', memberUserIds)
            .neq('status', 'archived'),
          // Get user details
          adminClient
            .from('users')
            .select('id, name, email')
            .in('id', memberUserIds),
          // Get workload summaries for all members
          ...memberUserIds.map((userId: string) =>
            Promise.resolve(adminClient.rpc('get_user_workload_summary', {
              p_user_id: userId,
              p_start_date: today,
              p_end_date: futureDate,
            })).then((result: any) => ({ userId, data: result.data, error: result.error }))
              .catch((error: any) => ({ userId, data: null, error }))
          ),
        ]);

        const tasks = tasksResult.data;
        const users = usersResult.data;
        const workloadsMap = new Map<string, any>();

        workloadResults.forEach((result: any) => {
          if (result?.data) {
            workloadsMap.set(result.userId, result.data);
          }
        });

        // Build sowMembers array for AI
        sowMembers = memberUserIds.map((userId: string) => {
          const user = users?.find((u: any) => u.id === userId);
          const memberInfo = memberMap.get(userId);
          const taskCount = tasks?.filter((t: any) => t.assignee_id === userId).length || 0;
          const workload = workloadsMap.get(userId);

          return {
            user_id: userId,
            name: user?.name || user?.email || 'Unknown',
            role_name: memberInfo?.role_name || 'Team Member',
            role_description: memberInfo?.role_description || null,
            current_task_count: taskCount,
            is_overworked: workload?.is_over_allocated || false,
          };
        });
      }
    } catch (sowError) {
      // Non-blocking: if loading fails, continue without members
      logger.warn('[Task Generator Preview] Could not load team members:', sowError);
    }

    // Generate tasks from prompt
    logger.info('[Task Generator Preview] Generating tasks from prompt:', {
      projectId: params.id,
      promptLength: prompt.length,
      sowMembersCount: sowMembers.length,
    });

    const generationResult = await generateTasksFromPrompt(
      prompt,
      project.name,
      phases.map((p) => ({
        phase_number: p.phase_number,
        phase_name: p.phase_name || undefined,
        display_order: p.display_order || p.phase_number,
        data: p.data || {},
        completed: p.completed || false,
      })),
      (existingTasks || []) as ProjectTask[],
      apiKey,
      context,
      sowMembers.length > 0 ? sowMembers : undefined
    );

    // Detect duplicates
    logger.info('[Task Generator Preview] Detecting duplicates:', {
      newTasksCount: generationResult.tasks.length,
      existingTasksCount: (existingTasks || []).length,
    });

    const duplicateResult = await detectDuplicates(
      generationResult.tasks,
      (existingTasks || []) as ProjectTask[],
      apiKey
    );

    // Log AI usage for task similarity (non-blocking)
    if (duplicateResult.metadata && userData?.id) {
      logAIUsage(
        adminClient,
        userData.id,
        'task_similarity',
        duplicateResult.metadata,
        'project',
        params.id
      ).catch((err) => {
        logger.error('[Task Generator Preview] Error logging task similarity usage:', err);
      });
    }

    const response: PreviewGenerationResponse = {
      tasks: duplicateResult.tasks,
      summary: generationResult.summary,
    };

    logger.info('[Task Generator Preview] Preview generated successfully:', {
      projectId: params.id,
      tasksCount: duplicateResult.tasks.length,
      duplicatesCount: duplicateResult.tasks.filter(
        (t) => t.duplicateStatus !== 'unique'
      ).length,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Task Generator Preview] Error:', error);
    return internalError('Failed to generate task preview', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

