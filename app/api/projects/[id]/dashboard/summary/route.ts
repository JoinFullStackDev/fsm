import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { generateAIResponse } from '@/lib/ai/geminiClient';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to generate summary');
    }

    const projectId = params.id;
    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Dashboard Summary API] User not found:', userError);
      return unauthorized('User record not found');
    }

    // Get project
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, name, description, owner_id, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      logger.error('[Dashboard Summary API] Project not found:', projectError);
      return notFound('Project not found');
    }

    // Check access - all project members can generate summary
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;

    let isProjectMember = false;
    if (!isSuperAdmin && !isProjectOwner) {
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .single();
      isProjectMember = !!projectMember;
    }

    if (!isSuperAdmin && !isProjectOwner && !isProjectMember && project.organization_id !== userData.organization_id) {
      return forbidden('You do not have access to this project');
    }

    // Get project data for summary
    const { data: tasks } = await adminClient
      .from('project_tasks')
      .select(`
        id,
        title,
        status,
        priority,
        due_date,
        phase_number,
        assignee_id,
        created_at,
        updated_at
      `)
      .eq('project_id', projectId)
      .neq('status', 'archived');

    const { data: phases } = await adminClient
      .from('project_phases')
      .select('phase_number, phase_name, completed')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const { data: members } = await adminClient
      .from('project_members')
      .select('user_id, users(id, name, email)')
      .eq('project_id', projectId);

    const projectMembers = members?.map(m => {
      const user = m.users as unknown as { id: string; name?: string; email?: string } | null;
      return {
        id: user?.id || m.user_id,
        name: user?.name || user?.email || 'Unknown',
      };
    }) || [];

    // Get assignee names for tasks
    const assigneeIds = [...new Set(tasks?.map(t => t.assignee_id).filter(Boolean) || [])];
    const assigneeMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const { data: assignees } = await adminClient
        .from('users')
        .select('id, name, email')
        .in('id', assigneeIds);
      
      assignees?.forEach(u => {
        assigneeMap[u.id] = u.name || u.email || 'Unknown';
      });
    }

    // Calculate metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
    const inProgressTasks = tasks?.filter(t => t.status === 'in_progress').length || 0;
    const pendingTasks = tasks?.filter(t => t.status === 'todo' || t.status === 'pending').length || 0;
    const overdueTasks = tasks?.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length || 0;

    // Workload by assignee
    const workloadByAssignee: Record<string, number> = {};
    tasks?.forEach(task => {
      if (task.assignee_id && task.status !== 'completed') {
        workloadByAssignee[task.assignee_id] = (workloadByAssignee[task.assignee_id] || 0) + 1;
      }
    });

    // Get Gemini API key
    const { getGeminiApiKey } = await import('@/lib/utils/geminiConfig');
    const apiKey = await getGeminiApiKey(supabase);

    if (!apiKey) {
      return internalError('Gemini API key not configured');
    }

    // Build context for AI
    const projectContext = {
      name: project.name,
      description: project.description || 'No description provided',
      phases: phases?.map(p => ({
        number: p.phase_number,
        name: p.phase_name,
        completed: p.completed,
      })) || [],
      taskMetrics: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
        overdue: overdueTasks,
      },
      teamMembers: projectMembers.length,
      workloadDistribution: Object.entries(workloadByAssignee).map(([id, count]) => ({
        name: assigneeMap[id] || 'Unassigned',
        taskCount: count,
      })),
      recentTasks: tasks?.slice(0, 10).map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee_id ? assigneeMap[t.assignee_id] : 'Unassigned',
        dueDate: t.due_date,
      })) || [],
    };

    const prompt = `You are an expert project manager analyzing a project dashboard. Generate a comprehensive, insightful summary of this project's current state.

Project Information:
- Name: ${projectContext.name}
- Description: ${projectContext.description}

Project Phases:
${projectContext.phases.map(p => `- Phase ${p.number}: ${p.name} ${p.completed ? '(Completed)' : '(In Progress)'}`).join('\n')}

Task Metrics:
- Total Tasks: ${projectContext.taskMetrics.total}
- Completed: ${projectContext.taskMetrics.completed}
- In Progress: ${projectContext.taskMetrics.inProgress}
- Pending: ${projectContext.taskMetrics.pending}
- Overdue: ${projectContext.taskMetrics.overdue}

Team: ${projectContext.teamMembers} member(s)

Workload Distribution:
${projectContext.workloadDistribution.map(w => `- ${w.name}: ${w.taskCount} active tasks`).join('\n')}

Recent Tasks:
${projectContext.recentTasks.map(t => `- ${t.title} (${t.status}, ${t.priority || 'no priority'}, assigned to ${t.assignee}${t.dueDate ? `, due ${new Date(t.dueDate).toLocaleDateString()}` : ''})`).join('\n')}

Generate a comprehensive project summary that includes:
1. **Project Overview**: Brief summary of what this project is about and its current state
2. **Progress Analysis**: Analysis of phase completion and overall progress
3. **Task Breakdown**: Insights into task distribution and completion rates
4. **Team Workload**: Analysis of workload distribution and potential bottlenecks
5. **Risk Indicators**: Highlight any concerns (overdue tasks, workload imbalances, blockers)
6. **Recent Activity**: Summary of recent task activity
7. **Next Steps**: Actionable recommendations for moving forward

Format the response as markdown with clear sections and bullet points. Be concise but comprehensive. Focus on actionable insights.`;

    // Generate summary (returns raw markdown text, not JSON)
    const summaryText = await generateAIResponse(
      prompt,
      {
        context: 'Generate project dashboard summary',
      },
      apiKey,
      project.name,
      false
    ) as string;

    // Save summary to database
    const { data: savedSummary, error: saveError } = await adminClient
      .from('project_summaries')
      .insert({
        project_id: projectId,
        user_id: userData.id,
        summary: summaryText,
      })
      .select('id, created_at')
      .single();

    if (saveError) {
      logger.warn('[Dashboard Summary API] Failed to save summary:', saveError);
      // Still return the summary even if save fails
    }

    return NextResponse.json({
      id: savedSummary?.id,
      summary: summaryText,
      generatedAt: savedSummary?.created_at || new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Dashboard Summary API] Unexpected error:', error);
    return internalError('Failed to generate summary', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET - List all saved summaries for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view summaries');
    }

    const projectId = params.id;
    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    // Get project to verify access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, owner_id, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Check access
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;

    let isProjectMember = false;
    if (!isSuperAdmin && !isProjectOwner) {
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .single();
      isProjectMember = !!projectMember;
    }

    if (!isSuperAdmin && !isProjectOwner && !isProjectMember && project.organization_id !== userData.organization_id) {
      return forbidden('You do not have access to this project');
    }

    // Get all summaries for this project
    const { data: summaries, error: summariesError } = await adminClient
      .from('project_summaries')
      .select(`
        id,
        summary,
        title,
        created_at,
        user:users!project_summaries_user_id_fkey(id, name, email)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (summariesError) {
      logger.error('[Dashboard Summary API] Error loading summaries:', summariesError);
      return internalError('Failed to load summaries');
    }

    return NextResponse.json({
      summaries: summaries || [],
    });
  } catch (error) {
    logger.error('[Dashboard Summary API] Unexpected error:', error);
    return internalError('Failed to load summaries', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE - Delete a saved summary
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to delete summaries');
    }

    const projectId = params.id;
    const summaryId = request.nextUrl.searchParams.get('summaryId');

    if (!summaryId) {
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    // Get summary to verify ownership
    const { data: summary, error: summaryError } = await adminClient
      .from('project_summaries')
      .select('id, project_id, user_id')
      .eq('id', summaryId)
      .single();

    if (summaryError || !summary) {
      return notFound('Summary not found');
    }

    if (summary.project_id !== projectId) {
      return forbidden('Summary does not belong to this project');
    }

    // Get project to check ownership
    const { data: project } = await adminClient
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    // Check permissions: summary creator, project owner, or admin
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isCreator = summary.user_id === userData.id;
    const isProjectOwner = project?.owner_id === userData.id;

    if (!isSuperAdmin && !isCreator && !isProjectOwner) {
      return forbidden('You do not have permission to delete this summary');
    }

    // Delete the summary
    const { error: deleteError } = await adminClient
      .from('project_summaries')
      .delete()
      .eq('id', summaryId);

    if (deleteError) {
      logger.error('[Dashboard Summary API] Error deleting summary:', deleteError);
      return internalError('Failed to delete summary');
    }

    return NextResponse.json({ message: 'Summary deleted successfully' });
  } catch (error) {
    logger.error('[Dashboard Summary API] Unexpected error:', error);
    return internalError('Failed to delete summary', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

