import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
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

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Verify user has access to this project
    const isOwner = project.owner_id === userData.id;
    const { data: memberData } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', userData.id)
      .single();

    if (!isOwner && !memberData) {
      return unauthorized('You do not have access to this project');
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
    const body: TaskInjectionRequest = await request.json();
    const { tasks, merges } = body;

    if (!tasks || !Array.isArray(tasks)) {
      return badRequest('Tasks array is required');
    }

    if (!merges || !Array.isArray(merges)) {
      return badRequest('Merges array is required');
    }

    // Filter to only selected tasks
    const selectedTasks = tasks.filter((t) => t.selected);
    
    if (selectedTasks.length === 0) {
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
          const notesData = previewTask.notes ? JSON.parse(previewTask.notes) : {};
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
            const notesObj = notes ? JSON.parse(notes) : {};
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
        // Get existing task
        const { data: existingTask, error: fetchError } = await supabase
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

        // Update existing task
        const { error: updateError } = await supabase
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

          // Create activity log entry for merge
          try {
            await supabase.from('activity_logs').insert({
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
      // Transform PreviewTask to ProjectTask by removing preview-only fields
      const tasksToInsert = allTasksToCreate.map((task) => {
        // Extract requirements and userStories from PreviewTask
        const { duplicateStatus, existingTaskId, requirements, userStories, previewId, ...taskData } = task;
        
        // Build notes JSONB structure if requirements or userStories exist
        let notes = task.notes;
        if (requirements && requirements.length > 0) {
          try {
            const notesObj = notes ? JSON.parse(notes) : {};
            notesObj.requirements = requirements;
            if (userStories && userStories.length > 0) {
              notesObj.userStories = userStories;
            }
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
          project_id: params.id,
          ai_generated: true,
          ai_analysis_id: null,
          notes: notes || null,
        };
      });

      const { data: insertedTasks, error: insertError } = await supabase
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
          
          await supabase.from('activity_logs').insert({
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
            },
          });
        } catch (activityError) {
          logger.warn('[Task Inject] Failed to create activity log:', activityError);
          // Don't fail the request if activity log fails
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

