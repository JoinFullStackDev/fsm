import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateTasksFromPrompt } from '@/lib/ai/taskGenerator';
import { detectDuplicates } from '@/lib/ai/taskSimilarity';
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
      .select('id, name, owner_id')
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
    const body: PreviewGenerationRequest = await request.json();
    const { prompt, context } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return badRequest('Prompt is required');
    }

    // Get project phases
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('phase_number, phase_name, display_order, data, completed')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      logger.error('[Task Generator Preview] Error loading phases:', phasesError);
      return internalError('Failed to load project phases', { error: phasesError.message });
    }

    if (!phases || phases.length === 0) {
      return badRequest('Project must have at least one phase');
    }

    // Get existing tasks
    const { data: existingTasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', params.id)
      .neq('status', 'archived'); // Exclude archived tasks from duplicate detection

    if (tasksError) {
      logger.error('[Task Generator Preview] Error loading tasks:', tasksError);
      return internalError('Failed to load existing tasks', { error: tasksError.message });
    }

    // Get Gemini API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return badRequest('Gemini API key not configured. Please configure it in Admin > API Config.');
    }

    // Generate tasks from prompt
    logger.info('[Task Generator Preview] Generating tasks from prompt:', {
      projectId: params.id,
      promptLength: prompt.length,
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
      context
    );

    // Detect duplicates
    logger.info('[Task Generator Preview] Detecting duplicates:', {
      newTasksCount: generationResult.tasks.length,
      existingTasksCount: (existingTasks || []).length,
    });

    const tasksWithDuplicates = await detectDuplicates(
      generationResult.tasks,
      (existingTasks || []) as ProjectTask[],
      apiKey
    );

    const response: PreviewGenerationResponse = {
      tasks: tasksWithDuplicates,
      summary: generationResult.summary,
    };

    logger.info('[Task Generator Preview] Preview generated successfully:', {
      projectId: params.id,
      tasksCount: tasksWithDuplicates.length,
      duplicatesCount: tasksWithDuplicates.filter(
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

