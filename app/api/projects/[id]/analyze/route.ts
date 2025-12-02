import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { analyzeProject, mergeTasks } from '@/lib/ai/projectAnalyzer';
import { sendProjectInitiatedEmail } from '@/lib/emailNotifications';
import logger from '@/lib/utils/logger';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import { ANALYSIS_TYPES, API_CONFIG_KEYS } from '@/lib/constants';
import type { ProjectTask, ProjectAnalysis } from '@/types/project';

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

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Get user record using admin client
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get project using admin client
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project');
    }

    // Get all active phases with data (ordered by display_order) using admin client
    const { data: phases, error: phasesError } = await adminClient
      .from('project_phases')
      .select('phase_number, phase_name, display_order, data, completed')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      logger.error('Error loading phases:', phasesError);
      return internalError('Failed to load project phases', { error: phasesError.message });
    }

    // Check if project is using default template using admin client
    let isDefaultTemplate = false;
    if (project.template_id) {
      const { data: template } = await adminClient
        .from('project_templates')
        .select('name')
        .eq('id', project.template_id)
        .single();
      
      isDefaultTemplate = template?.name === 'FullStack Method Default';
    } else {
      // If no template_id, assume it's using default (backward compatibility)
      isDefaultTemplate = true;
    }

    // Get existing tasks using admin client
    const { data: existingTasks, error: tasksError } = await adminClient
      .from('project_tasks')
      .select('*')
      .eq('project_id', params.id);

    if (tasksError) {
      logger.error('Error loading tasks:', tasksError);
      return internalError('Failed to load existing tasks', { error: tasksError.message });
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

    try {
      // Run AI analysis
      analysisResult = await analyzeProject(
        project.name,
        phases || [],
        existingTasks || [],
        apiKey,
        isDefaultTemplate
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

    // Update project if this is initial analysis using admin client
    if (isInitial) {
      await adminClient
        .from('projects')
        .update({
          initiated_at: new Date().toISOString(),
          initiated_by: userData.id,
        })
        .eq('id', params.id);

      // Send email notifications to project owner and members
      const projectLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${params.id}`;
      
      // Notify project owner
      if (project.owner_id) {
        sendProjectInitiatedEmail(
          project.owner_id,
          project.name,
          projectLink
        ).catch((err) => {
          logger.error('[Project Analysis] Error sending email to owner:', err);
        });
      }

      // Notify project members using admin client
      const { data: members } = await adminClient
        .from('project_members')
        .select('user_id')
        .eq('project_id', params.id);

      if (members) {
        for (const member of members) {
          if (member.user_id !== project.owner_id) {
            sendProjectInitiatedEmail(
              member.user_id,
              project.name,
              projectLink
            ).catch((err) => {
              logger.error('[Project Analysis] Error sending email to member:', err);
            });
          }
        }
      }
    }

    // Perform task operations in transaction-like manner
    const errors: string[] = [];

    // Update existing tasks
    for (const task of toUpdate) {
      const updateData: Partial<ProjectTask> = {
        updated_at: task.updated_at,
      };

      // Only update fields that are present in the task object
      // This allows partial updates (e.g., just dates for non-AI tasks)
      if (task.title !== undefined) updateData.title = task.title;
      if (task.description !== undefined) updateData.description = task.description;
      if (task.phase_number !== undefined) updateData.phase_number = task.phase_number;
      if (task.priority !== undefined) updateData.priority = task.priority;
      if (task.tags !== undefined) updateData.tags = task.tags;
      if (task.ai_analysis_id !== undefined) updateData.ai_analysis_id = task.ai_analysis_id;
      if (task.start_date !== undefined) updateData.start_date = task.start_date; // CRITICAL: Include start_date
      if (task.due_date !== undefined) updateData.due_date = task.due_date; // CRITICAL: Include due_date

      const { error } = await adminClient
        .from('project_tasks')
        .update(updateData)
        .eq('id', task.id);

      if (error) {
        errors.push(`Failed to update task ${task.id}: ${error.message}`);
        logger.error(`[Project Analysis] Update error for task ${task.id}:`, error);
        logger.error(`[Project Analysis] Update data:`, updateData);
      } else {
        logger.debug(`[Project Analysis] Updated task ${task.id} with start_date: ${task.start_date || 'null'}, due_date: ${task.due_date || 'null'}`);
      }
    }

    // Insert new tasks
    if (toInsert.length > 0) {
      const tasksToInsert = toInsert.map((task) => ({
        ...task,
        project_id: params.id,
      }));
      
      // Log tasks being inserted with their dates
      logger.debug(`[Project Analysis] Inserting ${tasksToInsert.length} new tasks:`);
      tasksToInsert.forEach((task) => {
        logger.debug(`  - "${task.title}" (Phase ${task.phase_number}): start_date = ${task.start_date || 'null'}, due_date = ${task.due_date || 'null'}`);
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

    // Archive old tasks using admin client
    for (const task of toArchive) {
      const { error } = await adminClient
        .from('project_tasks')
        .update({
          status: 'archived',
          updated_at: task.updated_at,
        })
        .eq('id', task.id);

      if (error) {
        errors.push(`Failed to archive task ${task.id}: ${error.message}`);
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

