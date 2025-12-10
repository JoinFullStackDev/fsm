import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { 
  unauthorized, 
  notFound, 
  badRequest, 
  forbidden, 
  internalError 
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { IssueDefinition } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/epics/[epicId]/create-tasks
 * Convert epic draft issues to project tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; epicId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, epicId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(epicId)) {
      return badRequest('Invalid ID format');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    const adminClient = createAdminSupabaseClient();

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Get epic
    const { data: epic } = await adminClient
      .from('epic_drafts')
      .select('*')
      .eq('id', epicId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!epic) {
      return notFound('Epic draft not found');
    }

    // Prepare tasks from issues
    const tasksToCreate: Array<{
      project_id: string;
      title: string;
      description: string | null;
      status: 'todo';
      priority: 'low' | 'medium' | 'high';
      estimated_hours: number | null;
      ai_generated: boolean;
      tags: string[];
      notes: string | null;
    }> = [];

    // Frontend issues
    if (epic.frontend_issues && Array.isArray(epic.frontend_issues)) {
      (epic.frontend_issues as IssueDefinition[]).forEach((issue) => {
        const acceptanceCriteria = issue.acceptance_criteria?.join('\n') || '';
        tasksToCreate.push({
          project_id: projectId,
          title: issue.title,
          description: `${issue.description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`,
          status: 'todo',
          priority: issue.priority || 'medium',
          estimated_hours: issue.estimated_hours || null,
          ai_generated: true,
          tags: ['frontend', `epic:${epic.title.toLowerCase().replace(/\s+/g, '-')}`],
          notes: `Generated from Epic: ${epic.title}`,
        });
      });
    }

    // Backend issues
    if (epic.backend_issues && Array.isArray(epic.backend_issues)) {
      (epic.backend_issues as IssueDefinition[]).forEach((issue) => {
        const acceptanceCriteria = issue.acceptance_criteria?.join('\n') || '';
        tasksToCreate.push({
          project_id: projectId,
          title: issue.title,
          description: `${issue.description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`,
          status: 'todo',
          priority: issue.priority || 'medium',
          estimated_hours: issue.estimated_hours || null,
          ai_generated: true,
          tags: ['backend', `epic:${epic.title.toLowerCase().replace(/\s+/g, '-')}`],
          notes: `Generated from Epic: ${epic.title}`,
        });
      });
    }

    // Design issues
    if (epic.design_issues && Array.isArray(epic.design_issues)) {
      (epic.design_issues as IssueDefinition[]).forEach((issue) => {
        const acceptanceCriteria = issue.acceptance_criteria?.join('\n') || '';
        tasksToCreate.push({
          project_id: projectId,
          title: issue.title,
          description: `${issue.description}\n\n**Acceptance Criteria:**\n${acceptanceCriteria}`,
          status: 'todo',
          priority: issue.priority || 'medium',
          estimated_hours: issue.estimated_hours || null,
          ai_generated: true,
          tags: ['design', `epic:${epic.title.toLowerCase().replace(/\s+/g, '-')}`],
          notes: `Generated from Epic: ${epic.title}`,
        });
      });
    }

    if (tasksToCreate.length === 0) {
      return badRequest('No issues found in epic draft');
    }

    // Insert tasks
    const { data: createdTasks, error } = await adminClient
      .from('project_tasks')
      .insert(tasksToCreate)
      .select('id');

    if (error || !createdTasks) {
      logger.error('[Epic Create Tasks API] Failed to create tasks:', error);
      return internalError('Failed to create tasks from epic');
    }

    // Update epic with generated task IDs
    const taskIds = createdTasks.map((t) => t.id);
    await adminClient
      .from('epic_drafts')
      .update({
        tasks_generated: true,
        tasks_generated_at: new Date().toISOString(),
        generated_task_ids: taskIds,
      })
      .eq('id', epicId);

    logger.info('[Epic Create Tasks API] Created tasks from epic:', {
      epicId,
      taskCount: createdTasks.length,
      projectId,
    });

    return NextResponse.json({
      success: true,
      task_count: createdTasks.length,
      task_ids: taskIds,
    });
  } catch (error) {
    logger.error('[Epic Create Tasks API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
