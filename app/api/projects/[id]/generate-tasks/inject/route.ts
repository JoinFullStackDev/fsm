import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { mergeTaskContent } from '@/lib/ai/taskMerger';
import logger from '@/lib/utils/logger';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import { getOrganizationContext, hasFeatureAccess } from '@/lib/organizationContext';
import type { TaskInjectionRequest, TaskInjectionResponse, PreviewTask } from '@/types/taskGenerator';
import type { ProjectTask } from '@/types/project';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to inject tasks');
    }

    // Use admin client to bypass RLS for user and project lookups
    const adminClient = createAdminSupabaseClient();

    // OPTIMIZATION: Parallelize user and project lookups
    const [userResult, projectResult] = await Promise.all([
      adminClient
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single(),
      adminClient
        .from('projects')
        .select('id, owner_id')
        .eq('id', params.id)
        .single(),
    ]);

    const { data: userData, error: userError } = userResult;
    const { data: project, error: projectError } = projectResult;

    if (userError || !userData) {
      logger.error('[Task Inject] User not found:', { authId: user.id, error: userError });
      return notFound('User');
    }

    if (projectError || !project) {
      logger.error('[Task Inject] Project not found:', { projectId: params.id, error: projectError });
      return notFound('Project not found');
    }

    // Check membership only if not owner (conditional query)
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

    // Check if organization has access to AI Task Generator
    const orgContext = await getOrganizationContext(supabase, user.id);
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
    const body: TaskInjectionRequest & { analysis_id?: string } = await request.json();
    const { tasks, merges, analysis_id } = body;

    logger.info('[Task Inject] Received request:', {
      projectId: params.id,
      tasksCount: tasks?.length,
      mergesCount: merges?.length,
      analysisId: analysis_id,
    });

    if (!tasks || !Array.isArray(tasks)) {
      logger.error('[Task Inject] Tasks array is missing or not an array:', typeof tasks);
      return badRequest('Tasks array is required');
    }

    if (!merges || !Array.isArray(merges)) {
      logger.error('[Task Inject] Merges array is missing or not an array:', typeof merges);
      return badRequest('Merges array is required');
    }

    // Filter to only selected tasks
    const selectedTasks = tasks.filter((t) => t.selected);
    
    logger.info('[Task Inject] Selected tasks:', {
      selectedCount: selectedTasks.length,
      firstTaskTitle: selectedTasks[0]?.task?.title,
    });
    
    if (selectedTasks.length === 0) {
      logger.warn('[Task Inject] No tasks were selected for injection');
      return badRequest('At least one task must be selected');
    }

    // Build merge map for quick lookup
    const mergeMap = new Map<string, { action: string; existingTaskId: string }>();
    for (const merge of merges) {
      mergeMap.set(merge.previewTaskId, {
        action: merge.action,
        existingTaskId: merge.existingTaskId,
      });
    }

    // Separate tasks into: to create, to merge, to discard
    // Use PreviewTask type to preserve preview-only fields until we transform them
    const tasksToCreate: PreviewTask[] = [];
    const tasksToMerge: Array<{ previewTask: PreviewTask; existingTaskId: string }> = [];
    const tasksToKeepBoth: PreviewTask[] = [];

    for (const taskInjection of selectedTasks) {
      const previewTask = taskInjection.task;
      const mergeInfo = previewTask.previewId ? mergeMap.get(previewTask.previewId) : null;

      if (mergeInfo) {
        if (mergeInfo.action === 'merge') {
          tasksToMerge.push({
            previewTask,
            existingTaskId: mergeInfo.existingTaskId,
          });
        } else if (mergeInfo.action === 'keep-both') {
          // Add duplicate warning note
          let notesData: Record<string, any> = {};
          if (previewTask.notes) {
            try {
              notesData = JSON.parse(previewTask.notes);
            } catch {
              // Notes is plain text, not JSON - wrap it
              notesData = { text: previewTask.notes };
            }
          }
          notesData.duplicateWarning = `This task may be a duplicate of task ${mergeInfo.existingTaskId}`;
          
          // Ensure requirements and userStories are in notes
          if (previewTask.requirements && previewTask.requirements.length > 0) {
            notesData.requirements = previewTask.requirements;
          }
          if (previewTask.userStories && previewTask.userStories.length > 0) {
            notesData.userStories = previewTask.userStories;
          }
          
          // Keep all PreviewTask fields, just update notes
          // project_id will be added during database insertion
          tasksToKeepBoth.push({
            ...previewTask,
            notes: JSON.stringify(notesData),
          });
        }
        // 'discard' action - do nothing, task is discarded
      } else {
        // No merge action - create as new task
        // Build notes JSONB structure
        let notes = previewTask.notes;
        if (previewTask.requirements && previewTask.requirements.length > 0) {
          try {
            let notesObj: Record<string, any> = {};
            if (notes) {
              try {
                notesObj = JSON.parse(notes);
              } catch {
                // Notes is plain text, not JSON - wrap it
                notesObj = { text: notes };
              }
            }
            notesObj.requirements = previewTask.requirements;
            if (previewTask.userStories && previewTask.userStories.length > 0) {
              notesObj.userStories = previewTask.userStories;
            }
            notes = JSON.stringify(notesObj);
          } catch (e) {
            // If notes isn't valid JSON, create new structure
            const notesObj: any = { requirements: previewTask.requirements };
            if (previewTask.userStories && previewTask.userStories.length > 0) {
              notesObj.userStories = previewTask.userStories;
            }
            notes = JSON.stringify(notesObj);
          }
        }
        
        // Keep all PreviewTask fields, just update notes
        // project_id will be added during database insertion
        tasksToCreate.push({
          ...previewTask,
          notes: notes || null,
        });
      }
    }

    const errors: string[] = [];
    let createdCount = 0;
    let mergedCount = 0;

    // Perform merges
    for (const { previewTask, existingTaskId } of tasksToMerge) {
      try {
        // Get existing task using admin client
        const { data: existingTask, error: fetchError } = await adminClient
          .from('project_tasks')
          .select('*')
          .eq('id', existingTaskId)
          .eq('project_id', params.id)
          .single();

        if (fetchError || !existingTask) {
          errors.push(`Failed to find existing task ${existingTaskId} for merge`);
          continue;
        }

        // Merge content
        const updates = mergeTaskContent(
          existingTask as ProjectTask,
          previewTask
        );

        // Update existing task using admin client
        const { error: updateError } = await adminClient
          .from('project_tasks')
          .update(updates)
          .eq('id', existingTaskId);

        if (updateError) {
          errors.push(`Failed to merge task ${existingTaskId}: ${updateError.message}`);
          logger.error('[Task Inject] Merge error:', updateError);
        } else {
          mergedCount++;
          logger.info('[Task Inject] Merged task:', {
            existingTaskId,
            previewTaskTitle: previewTask.title,
          });

          // Create activity log entry for merge using admin client
          try {
            await adminClient.from('activity_logs').insert({
              user_id: userData.id,
              action_type: 'task_merged',
              resource_type: 'task',
              resource_id: existingTaskId,
              metadata: {
                mergedFrom: 'ai-task-generator',
                previewTaskTitle: previewTask.title,
              },
            });
          } catch (activityError) {
            logger.warn('[Task Inject] Failed to create activity log:', activityError);
            // Don't fail the request if activity log fails
          }
        }
      } catch (error) {
        errors.push(`Error merging task ${existingTaskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logger.error('[Task Inject] Merge error:', error);
      }
    }

    // Create new tasks (including keep-both tasks)
    const allTasksToCreate = [...tasksToCreate, ...tasksToKeepBoth];

    if (allTasksToCreate.length > 0) {
      // Get project members for assignee validation
      // adminClient already created above
      const { data: projectMembers } = await adminClient
        .from('project_members')
        .select('user_id')
        .eq('project_id', params.id);

      const projectMemberUserIds = new Set(projectMembers?.map(pm => pm.user_id) || []);

      // Get user names to UUIDs mapping for validation (in case AI returns names instead of UUIDs)
      const { data: users } = await adminClient
        .from('users')
        .select('id, name, email')
        .in('id', projectMembers?.map(pm => pm.user_id) || []);

      const userNameToIdMap = new Map<string, string>();
      users?.forEach(u => {
        if (u.name) userNameToIdMap.set(u.name.toLowerCase(), u.id);
        if (u.email) userNameToIdMap.set(u.email.toLowerCase(), u.id);
      });

      // Track auto-assignments for logging
      const autoAssignments: Array<{ taskTitle: string; assigneeId: string }> = [];

      // Transform PreviewTask to ProjectTask by removing preview-only fields
      const tasksToInsert = allTasksToCreate.map((task) => {
        // Extract requirements and userStories from PreviewTask
        const { duplicateStatus, existingTaskId, requirements, userStories, previewId, assignee_id, ...taskData } = task;
        
        // Validate assignee if provided
        let validatedAssigneeId = null;
        if (assignee_id) {
          // Check if it's a UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          
          let assigneeIdToCheck: string | null = assignee_id;
          if (!uuidRegex.test(assignee_id)) {
            // It's not a UUID, try to map from name
            const userId = userNameToIdMap.get(assignee_id.toLowerCase());
            if (userId) {
              assigneeIdToCheck = userId;
              logger.warn(`[Task Inject] Mapped assignee name "${assignee_id}" to UUID "${userId}"`);
            } else {
              logger.warn(`[Task Inject] AI suggested assignee "${assignee_id}" is not a valid UUID or name. Task will be unassigned.`);
              assigneeIdToCheck = null;
            }
          }

          if (assigneeIdToCheck) {
            // Verify assignee is a project member
            if (projectMemberUserIds.has(assigneeIdToCheck)) {
              validatedAssigneeId = assigneeIdToCheck;
              
            autoAssignments.push({
              taskTitle: task.title,
              assigneeId: assigneeIdToCheck,
            });
            } else {
              logger.warn(`[Task Inject] AI suggested assignee ${assigneeIdToCheck} is not a project member for task: ${task.title}`);
            }
          }
        }
        
        // Build notes JSONB structure if requirements or userStories exist
        let notes = task.notes;
        if (requirements && requirements.length > 0) {
          try {
            let notesObj: Record<string, any> = {};
            if (notes) {
              try {
                notesObj = JSON.parse(notes);
              } catch {
                // Notes is plain text, not JSON - wrap it
                notesObj = { text: notes };
              }
            }
            notesObj.requirements = requirements;
            if (userStories && userStories.length > 0) {
              notesObj.userStories = userStories;
            }
            // Note: assignee_role is not stored - it's only used by AI for assignment decisions
            notes = JSON.stringify(notesObj);
          } catch (e) {
            // If notes isn't valid JSON, create new structure
            const notesObj: any = { requirements };
            if (userStories && userStories.length > 0) {
              notesObj.userStories = userStories;
            }
            notes = JSON.stringify(notesObj);
          }
        }

        return {
          ...taskData,
          assignee_id: validatedAssigneeId,
          project_id: params.id,
          ai_generated: true,
          ai_analysis_id: analysis_id || null,
          notes: notes || null,
        };
      });

      const { data: insertedTasks, error: insertError } = await adminClient
        .from('project_tasks')
        .insert(tasksToInsert)
        .select();

      if (insertError) {
        errors.push(`Failed to create tasks: ${insertError.message}`);
        logger.error('[Task Inject] Insert error:', insertError);
      } else {
        createdCount = insertedTasks?.length || 0;
        logger.info('[Task Inject] Created tasks:', {
          count: createdCount,
          projectId: params.id,
        });

        // Create activity log entry for batch creation with enhanced metadata
        try {
          // Estimate usage for task generation (tasks were generated via AI earlier in the flow)
          const estimatedPromptLength = JSON.stringify(selectedTasks).length + 1000; // Base prompt overhead
          const estimatedResponseLength = JSON.stringify(insertedTasks).length;
          const estimatedInputTokens = Math.ceil(estimatedPromptLength / 4);
          const estimatedOutputTokens = Math.ceil(estimatedResponseLength / 4);
          const estimatedCost = (estimatedInputTokens * 0.075 / 1_000_000) + (estimatedOutputTokens * 0.30 / 1_000_000);
          
          await adminClient.from('activity_logs').insert({
            user_id: userData.id,
            action_type: 'tasks_generated',
            resource_type: 'project',
            resource_id: params.id,
            metadata: {
              feature_type: 'tasks_generated',
              count: createdCount,
              source: 'ai-task-generator',
              full_prompt_length: estimatedPromptLength,
              response_length: estimatedResponseLength,
              model: 'gemini-2.5-flash',
              input_tokens: estimatedInputTokens,
              output_tokens: estimatedOutputTokens,
              total_tokens: estimatedInputTokens + estimatedOutputTokens,
              estimated_cost: estimatedCost,
              auto_assignments: autoAssignments.length > 0 ? autoAssignments : undefined,
            },
          });
        } catch (activityError) {
          logger.warn('[Task Inject] Failed to create activity log:', activityError);
          // Don't fail the request if activity log fails
        }

        // Log auto-assignments if any
        if (autoAssignments.length > 0) {
          logger.info('[Task Inject] Auto-assignments made:', {
            count: autoAssignments.length,
            assignments: autoAssignments,
          });
        }
      }
    }

    const response: TaskInjectionResponse = {
      created: createdCount,
      merged: mergedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    logger.info('[Task Inject] Injection completed:', {
      projectId: params.id,
      created: createdCount,
      merged: mergedCount,
      errors: errors.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Task Inject] Error:', error);
    return internalError('Failed to inject tasks', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

