import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { analyzeProject, mergeTasks } from '@/lib/ai/projectAnalyzer';
import { sendProjectInitiatedEmail } from '@/lib/emailNotifications';
import logger from '@/lib/utils/logger';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import { ANALYSIS_TYPES, API_CONFIG_KEYS } from '@/lib/constants';
import type { ProjectTask, ProjectAnalysis } from '@/types/project';

// Local types for SOW member queries
// Note: Supabase returns arrays for nested relations in joins
interface SOWProjectMemberData {
  project_member?: Array<{
    user_id: string;
    role: string;
    user?: Array<{
      id: string;
      name: string | null;
      email: string;
    }>;
  }>;
  organization_role?: Array<{
    name: string;
    description: string | null;
  }>;
}

interface AllocationData {
  user_id: string;
  allocated_hours_per_week: number;
  user?: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
}

interface ProjectMemberData {
  user_id: string;
  role: string;
}

interface WorkloadResult {
  userId: string;
  data: { is_over_allocated?: boolean } | null;
  error: unknown;
}

interface UserData {
  id: string;
  name: string | null;
  email: string;
}

interface TaskData {
  assignee_id: string | null;
  status: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to analyze projects');
    }

    // Check if this is a preview request
    const searchParams = request.nextUrl.searchParams;
    const isPreview = searchParams.get('preview') === 'true';

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // OPTIMIZATION: Parallelize all initial data fetching
    const [userResult, projectResult, phasesResult, tasksResult] = await Promise.all([
      // Get user record
      adminClient
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single(),
      // Get project
      adminClient
        .from('projects')
        .select('*')
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
        .eq('project_id', params.id),
    ]);

    const { data: userData, error: userError } = userResult;
    const { data: project, error: projectError } = projectResult;
    const { data: phases, error: phasesError } = phasesResult;
    const { data: existingTasks, error: tasksError } = tasksResult;

    if (userError || !userData) {
      return notFound('User');
    }

    if (projectError || !project) {
      return notFound('Project');
    }

    if (phasesError) {
      logger.error('Error loading phases:', phasesError);
      return internalError('Failed to load project phases', { error: phasesError.message });
    }

    if (tasksError) {
      logger.error('Error loading tasks:', tasksError);
      return internalError('Failed to load existing tasks', { error: tasksError.message });
    }

    // Check if project is using default template (separate query since it depends on project.template_id)
    let isDefaultTemplate = true; // Default
    if (project.template_id) {
      const { data: template } = await adminClient
        .from('project_templates')
        .select('name')
        .eq('id', project.template_id)
        .single();
      
      isDefaultTemplate = template?.name === 'FullStack Method Default';
    }

    // Get Gemini API key (prioritizes environment variable - super admin's credentials)
    const { getGeminiApiKey } = await import('@/lib/utils/geminiConfig');
    const apiKey = await getGeminiApiKey(supabase);

    if (!apiKey) {
      return badRequest('Gemini API key not configured. Please configure GOOGLE_GENAI_API_KEY environment variable or Admin Settings.');
    }

    const startTime = Date.now();
    let analysisResult;
    let error: string | undefined = undefined;

    // Load team members for auto-assignment (SOW members or resource allocations)
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
          .map((pm: SOWProjectMemberData) => pm.project_member?.[0]?.user_id)
          .filter((id): id is string => Boolean(id));

        activeSOW.project_members.forEach((pm: SOWProjectMemberData) => {
          const projectMember = pm.project_member?.[0];
          const userId = projectMember?.user_id;
          if (userId) {
            const orgRole = pm.organization_role?.[0];
            const roleName = orgRole?.name || projectMember?.role || 'Team Member';
            const roleDescription = orgRole?.description || null;
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
          memberUserIds = allocations.map((a: AllocationData) => a.user_id).filter((id): id is string => Boolean(id));
          
          // Get project members to get their roles
          const { data: projectMembers } = await adminClient
            .from('project_members')
            .select('user_id, role')
            .eq('project_id', params.id)
            .in('user_id', memberUserIds);

          allocations.forEach((alloc: AllocationData) => {
            const userId = alloc.user_id;
            const pm = (projectMembers as ProjectMemberData[] | null)?.find((pm) => pm.user_id === userId);
            const roleName = pm?.role || 'Team Member';
            memberMap.set(userId, { role_name: roleName, role_description: null });
          });
        } else {
          // FALLBACK: No SOW and no allocations - try direct project_members
          logger.info('[Project Analyze] No SOW or allocations, falling back to project_members');
          const { data: directMembers } = await adminClient
            .from('project_members')
            .select(`
              user_id,
              role,
              user:users!project_members_user_id_fkey(
                id,
                name,
                email
              )
            `)
            .eq('project_id', params.id);

          if (directMembers && directMembers.length > 0) {
            memberUserIds = directMembers
              .map((m: { user_id: string }) => m.user_id)
              .filter((id): id is string => Boolean(id));
            
            directMembers.forEach((m: { user_id: string; role: string | null }) => {
              memberMap.set(m.user_id, { 
                role_name: m.role || 'Team Member', 
                role_description: null 
              });
            });
          }
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
            })).then((result) => ({ userId, data: result.data as { is_over_allocated?: boolean } | null, error: result.error }))
              .catch((error: unknown) => ({ userId, data: null, error }))
          ),
        ]);

        const tasks = tasksResult.data as TaskData[] | null;
        const users = usersResult.data as UserData[] | null;
        const workloadsMap = new Map<string, { is_over_allocated?: boolean }>();

        (workloadResults as WorkloadResult[]).forEach((result) => {
          if (result?.data) {
            workloadsMap.set(result.userId, result.data);
          }
        });

        // Build sowMembers array for AI
        sowMembers = memberUserIds.map((userId: string) => {
          const user = users?.find((u) => u.id === userId);
          const memberInfo = memberMap.get(userId);
          const taskCount = tasks?.filter((t) => t.assignee_id === userId).length || 0;
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
    } catch (memberError) {
      // Non-blocking: if loading fails, continue without members
      logger.warn('[Project Analyze] Could not load team members:', memberError);
    }

    try {
      // Run AI analysis with team members for auto-assignment
      analysisResult = await analyzeProject(
        project.name,
        phases || [],
        existingTasks || [],
        apiKey,
        isDefaultTemplate,
        sowMembers.length > 0 ? sowMembers : undefined
      );
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[Project Analyze] Error:', err);
      
      // Log error to activity logs using admin client
      const responseTime = Date.now() - startTime;
      Promise.resolve(
        adminClient
          .from('activity_logs')
          .insert({
            user_id: userData.id,
            action_type: 'project_analyze',
            resource_type: 'project',
            resource_id: params.id,
            metadata: {
              feature_type: 'project_analyze',
              analysis_type: !project.initiated_at ? 'initial' : 'update',
              tasks_generated: 0,
              is_default_template: isDefaultTemplate,
              model: 'gemini-2.5-flash',
              response_time_ms: responseTime,
              estimated_cost: 0,
              error,
              error_type: err instanceof Error && err.message.includes('401') ? 'authentication' :
                          err instanceof Error && err.message.includes('429') ? 'rate_limit' : 'api_error',
            },
          })
      ).catch((logError) => {
        logger.error('[Project Analyze] Error logging AI usage:', logError);
      });
      
      throw err; // Re-throw to be handled by outer catch
    }

    const responseTime = Date.now() - startTime;
    
    // Estimate usage (analyzeProject makes one structured AI call)
    // We'll estimate based on the project complexity
    const phaseDataLength = JSON.stringify(phases || []).length;
    const existingTasksLength = JSON.stringify(existingTasks || []).length;
    const estimatedPromptLength = project.name.length + phaseDataLength + existingTasksLength + 2000; // Base prompt overhead
    const estimatedResponseLength = JSON.stringify(analysisResult).length;
    
    // Rough token estimation (1 token ≈ 4 chars)
    const estimatedInputTokens = Math.ceil(estimatedPromptLength / 4);
    const estimatedOutputTokens = Math.ceil(estimatedResponseLength / 4);
    const estimatedCost = (estimatedInputTokens * 0.075 / 1_000_000) + (estimatedOutputTokens * 0.30 / 1_000_000);

    // Log AI usage for project analysis with enhanced metadata (non-blocking) using admin client
    Promise.resolve(
      adminClient
        .from('activity_logs')
        .insert({
          user_id: userData.id,
          action_type: 'project_analyze',
          resource_type: 'project',
          resource_id: params.id,
          metadata: {
            feature_type: 'project_analyze',
            analysis_type: !project.initiated_at ? 'initial' : 'update',
            tasks_generated: analysisResult.tasks.length,
            is_default_template: isDefaultTemplate,
            full_prompt_length: estimatedPromptLength,
            response_length: estimatedResponseLength,
            model: 'gemini-2.5-flash',
            response_time_ms: responseTime,
            input_tokens: estimatedInputTokens,
            output_tokens: estimatedOutputTokens,
            total_tokens: estimatedInputTokens + estimatedOutputTokens,
            estimated_cost: estimatedCost,
          },
        })
    ).catch((logError) => {
      logger.error('[Project Analyze] Error logging AI usage:', logError);
      // Don't fail the request if logging fails
    });

    // Determine analysis type
    const isInitial = !project.initiated_at;
    const analysisType: ProjectAnalysis['analysis_type'] = isInitial ? ANALYSIS_TYPES.INITIAL : ANALYSIS_TYPES.UPDATE;

    // Create analysis record using admin client
    const { data: analysis, error: analysisInsertError } = await adminClient
      .from('project_analyses')
      .insert({
        project_id: params.id,
        analysis_type: analysisType,
        summary: analysisResult.summary,
        next_steps: analysisResult.next_steps,
        blockers: analysisResult.blockers,
        estimates: analysisResult.estimates,
        tasks_generated: analysisResult.tasks.length,
      })
      .select()
      .single();

    if (analysisInsertError || !analysis) {
      logger.error('Error creating analysis:', analysisInsertError);
      return internalError('Failed to create analysis', { error: analysisInsertError?.message });
    }

    // Merge tasks
    const { toUpdate, toInsert, toArchive } = mergeTasks(
      existingTasks || [],
      analysisResult.tasks.map((task) => ({
        ...task,
        project_id: params.id,
      })),
      analysis.id
    );

    // If preview mode, return tasks without inserting
    if (isPreview) {
      return NextResponse.json({
        preview: true,
        tasks: [...toInsert, ...toUpdate.map(t => ({ ...t, isUpdate: true }))],
        summary: analysisResult.summary,
        next_steps: analysisResult.next_steps,
        blockers: analysisResult.blockers,
        estimates: analysisResult.estimates,
        analysis_id: analysis.id,
      });
    }

    // Update project if this is initial analysis using admin client
    if (isInitial) {
      // OPTIMIZATION: Update project and get members in parallel
      const [, membersResult] = await Promise.all([
        adminClient
          .from('projects')
          .update({
            initiated_at: new Date().toISOString(),
            initiated_by: userData.id,
          })
          .eq('id', params.id),
        adminClient
          .from('project_members')
          .select('user_id')
          .eq('project_id', params.id),
      ]);

      // OPTIMIZATION: Send all email notifications in parallel (non-blocking)
      const projectLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${params.id}`;
      const emailPromises: Promise<void>[] = [];
      
      // Notify project owner
      if (project.owner_id) {
        emailPromises.push(
          sendProjectInitiatedEmail(project.owner_id, project.name, projectLink)
            .catch((err) => logger.error('[Project Analysis] Error sending email to owner:', err))
        );
      }

      // Notify project members
      const members = membersResult.data;
      if (members) {
        members.forEach((member) => {
          if (member.user_id !== project.owner_id) {
            emailPromises.push(
              sendProjectInitiatedEmail(member.user_id, project.name, projectLink)
                .catch((err) => logger.error('[Project Analysis] Error sending email to member:', err))
            );
          }
        });
      }

      // Fire and forget - don't await email sending
      Promise.all(emailPromises).catch(() => {});
    }

    // Perform task operations in transaction-like manner
    const errors: string[] = [];

    // Build user name to UUID map for validation
    const userNameToIdMap = new Map<string, string>();
    if (sowMembers && sowMembers.length > 0) {
      sowMembers.forEach(m => {
        userNameToIdMap.set(m.name.toLowerCase(), m.user_id);
      });
    }

    // OPTIMIZATION: Batch update existing tasks instead of one-by-one
    if (toUpdate.length > 0) {
      const updatePromises = toUpdate.map(async (task) => {
        const updateData: Partial<ProjectTask> = {
          updated_at: task.updated_at,
        };

        // Only update fields that are present in the task object
        if (task.title !== undefined) updateData.title = task.title;
        if (task.description !== undefined) updateData.description = task.description;
        if (task.phase_number !== undefined) updateData.phase_number = task.phase_number;
        if (task.priority !== undefined) updateData.priority = task.priority;
        if (task.tags !== undefined) updateData.tags = task.tags;
        if (task.ai_analysis_id !== undefined) updateData.ai_analysis_id = task.ai_analysis_id;
        if (task.start_date !== undefined) updateData.start_date = task.start_date;
        if (task.due_date !== undefined) updateData.due_date = task.due_date;
        if (task.source_reference !== undefined) updateData.source_reference = task.source_reference;
        
        // Validate and fix assignee_id if it's a name instead of UUID
        if (task.assignee_id !== undefined) {
          let validatedAssigneeId = task.assignee_id;
          if (task.assignee_id && typeof task.assignee_id === 'string') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(task.assignee_id)) {
              const userId = userNameToIdMap.get(task.assignee_id.toLowerCase());
              validatedAssigneeId = userId || null;
            }
          }
          updateData.assignee_id = validatedAssigneeId;
        }

        return adminClient
          .from('project_tasks')
          .update(updateData)
          .eq('id', task.id)
          .then(({ error }) => {
            if (error) {
              errors.push(`Failed to update task ${task.id}: ${error.message}`);
            }
            return { taskId: task.id, error };
          });
      });

      // Run all updates in parallel
      await Promise.all(updatePromises);
      logger.debug(`[Project Analysis] Batch updated ${toUpdate.length} tasks`);
    }

    // Insert new tasks
    if (toInsert.length > 0) {
      // Map assignee names to UUIDs if needed, and remove assignee_role (not in schema)
      const tasksToInsert = toInsert.map((task) => {
        // Build user name to UUID map for validation
        const userNameToIdMap = new Map<string, string>();
        if (sowMembers && sowMembers.length > 0) {
          sowMembers.forEach(m => {
            userNameToIdMap.set(m.name.toLowerCase(), m.user_id);
          });
        }

        // Validate and fix assignee_id if it's a name instead of UUID
        let validatedAssigneeId = task.assignee_id;
        if (task.assignee_id && typeof task.assignee_id === 'string') {
          // Check if it's a UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(task.assignee_id)) {
            // It's not a UUID, try to map from name
            const userId = userNameToIdMap.get(task.assignee_id.toLowerCase());
            if (userId) {
              validatedAssigneeId = userId;
              logger.warn(`[Project Analysis] Mapped assignee name "${task.assignee_id}" to UUID "${userId}"`);
            } else {
              logger.warn(`[Project Analysis] Could not map assignee name "${task.assignee_id}" to UUID, setting to null`);
              validatedAssigneeId = null;
            }
          }
        }

        // Remove fields not in database schema, but keep source_reference
        const { assignee_role, source_fields, ...taskWithoutExtraFields } = task as ProjectTask & { assignee_role?: string; source_fields?: Array<{ phase: number; field: string }> };
        
        return {
          ...taskWithoutExtraFields,
          assignee_id: validatedAssigneeId,
          project_id: params.id,
          // source_reference is included from taskWithoutExtraFields (from analyzeProject)
        };
      });
      
      // Log tasks being inserted with their dates and source references
      logger.debug(`[Project Analysis] Inserting ${tasksToInsert.length} new tasks:`);
      tasksToInsert.forEach((task) => {
        const sourceRef = task.source_reference?.[0];
        const srcInfo = sourceRef ? `src:P${sourceRef.phase_number}.${sourceRef.field_key}` : 'no-src';
        logger.debug(`  - "${task.title}" (Phase ${task.phase_number}): ${srcInfo}, due=${task.due_date || 'null'}, assignee=${task.assignee_id || 'null'}`);
      });

      const { data: insertedTasks, error } = await adminClient
        .from('project_tasks')
        .insert(tasksToInsert)
        .select();

      if (error) {
        errors.push(`Failed to insert tasks: ${error.message}`);
        logger.error(`[Project Analysis] Insert error:`, error);
        logger.error(`[Project Analysis] Tasks that failed to insert:`, tasksToInsert);
      } else {
        logger.debug(`[Project Analysis] Successfully inserted ${insertedTasks?.length || 0} tasks`);
        if (insertedTasks && insertedTasks.length > 0) {
          logger.debug(`[Project Analysis] Inserted task IDs:`, insertedTasks.map(t => t.id));
        }
      }
    }

    // OPTIMIZATION: Batch archive old tasks in a single query
    if (toArchive.length > 0) {
      const archiveIds = toArchive.map(t => t.id);
      const { error: archiveError } = await adminClient
        .from('project_tasks')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .in('id', archiveIds);

      if (archiveError) {
        errors.push(`Failed to archive ${toArchive.length} tasks: ${archiveError.message}`);
      } else {
        logger.debug(`[Project Analysis] Batch archived ${toArchive.length} tasks`);
      }
    }

    if (errors.length > 0) {
      logger.error('[Project Analysis] Task operation errors:', errors);
      // Still return success, but log errors
    }

    return NextResponse.json({
      analysis,
      tasksCreated: toInsert.length,
      tasksUpdated: toUpdate.length,
      tasksArchived: toArchive.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('[Project Analysis] Error:', error);
    return internalError('Failed to analyze project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

