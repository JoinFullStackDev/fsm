import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { analyzeProject, mergeTasks } from '@/lib/ai/projectAnalyzer';
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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to analyze projects');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project');
    }

    // Get all active phases with data (ordered by display_order)
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('phase_number, phase_name, display_order, data, completed')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      logger.error('Error loading phases:', phasesError);
      return internalError('Failed to load project phases', { error: phasesError.message });
    }

    // Check if project is using default template
    let isDefaultTemplate = false;
    if (project.template_id) {
      const { data: template } = await supabase
        .from('project_templates')
        .select('name')
        .eq('id', project.template_id)
        .single();
      
      isDefaultTemplate = template?.name === 'FullStack Method Default';
    } else {
      // If no template_id, assume it's using default (backward compatibility)
      isDefaultTemplate = true;
    }

    // Get existing tasks
    const { data: existingTasks, error: tasksError } = await supabase
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

    // Run AI analysis
    const analysisResult = await analyzeProject(
      project.name,
      phases || [],
      existingTasks || [],
      apiKey,
      isDefaultTemplate
    );

    // Determine analysis type
    const isInitial = !project.initiated_at;
    const analysisType: ProjectAnalysis['analysis_type'] = isInitial ? ANALYSIS_TYPES.INITIAL : ANALYSIS_TYPES.UPDATE;

    // Create analysis record
    const { data: analysis, error: analysisInsertError } = await supabase
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

    // Update project if this is initial analysis
    if (isInitial) {
      await supabase
        .from('projects')
        .update({
          initiated_at: new Date().toISOString(),
          initiated_by: userData.id,
        })
        .eq('id', params.id);
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

      const { error } = await supabase
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

      const { data: insertedTasks, error } = await supabase
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

    // Archive old tasks
    for (const task of toArchive) {
      const { error } = await supabase
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

