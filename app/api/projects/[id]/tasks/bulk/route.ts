import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import { sendTaskAssignedEmail, sendTaskUpdatedEmail } from '@/lib/emailNotifications';
import { getAppUrl } from '@/lib/utils/appUrl';

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function badRequest(message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

function internalError(message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, details }, { status: 500 });
}

/**
 * Bulk operations on tasks
 * POST /api/projects/[id]/tasks/bulk
 * 
 * Body:
 * {
 *   taskIds: string[],
 *   operation: 'delete' | 'reassign' | 'status' | 'priority',
 *   value?: string (for reassign: user_id, for status: TaskStatus, for priority: TaskPriority)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to perform bulk operations');
    }

    const body = await request.json();
    const { taskIds, operation, value } = body;

    // Validation
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return badRequest('taskIds must be a non-empty array');
    }

    if (!['delete', 'reassign', 'status', 'priority'].includes(operation)) {
      return badRequest('Invalid operation. Must be one of: delete, reassign, status, priority');
    }

    // Validate operation-specific values
    // For reassign, value can be empty string (unassign) or a user_id
    if (operation === 'reassign' && value === undefined) {
      return badRequest('value (user_id or empty string for unassign) is required for reassign operation');
    }

    if (operation === 'status' && !value) {
      return badRequest('value (status) is required for status operation');
    }

    if (operation === 'priority' && !value) {
      return badRequest('value (priority) is required for priority operation');
    }

    // Verify all tasks belong to this project
    const adminClient = createAdminSupabaseClient();
    const { data: tasks, error: tasksError } = await adminClient
      .from('project_tasks')
      .select('id, project_id, assignee_id, title')
      .eq('project_id', params.id)
      .in('id', taskIds);

    if (tasksError) {
      logger.error('[Bulk Tasks] Error fetching tasks:', tasksError);
      return internalError('Failed to fetch tasks', { error: tasksError.message });
    }

    if (!tasks || tasks.length === 0) {
      return badRequest('No tasks found matching the provided IDs');
    }

    if (tasks.length !== taskIds.length) {
      return badRequest('Some tasks do not belong to this project or do not exist');
    }

    // Get project info for notifications
    const { data: project } = await adminClient
      .from('projects')
      .select('name')
      .eq('id', params.id)
      .single();

    // Perform bulk operation
    let result;
    const adminSupabase = createAdminSupabaseClient();

    switch (operation) {
      case 'delete': {
        // Delete tasks
        const { error: deleteError } = await adminSupabase
          .from('project_tasks')
          .delete()
          .in('id', taskIds)
          .eq('project_id', params.id);

        if (deleteError) {
          logger.error('[Bulk Tasks] Error deleting tasks:', deleteError);
          return internalError('Failed to delete tasks', { error: deleteError.message });
        }

        result = {
          operation: 'delete',
          count: taskIds.length,
          taskIds,
        };
        break;
      }

      case 'reassign': {
        // value can be empty string (unassign) or a user_id
        const assigneeId = value === '' ? null : value;

        // If assigning (not unassigning), validate assignee is a project member
        if (assigneeId) {
          const { data: projectMembers } = await adminSupabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', params.id)
            .eq('user_id', assigneeId);

          if (!projectMembers || projectMembers.length === 0) {
            return badRequest('Assignee must be a project member');
          }
        }

        // Get user info for notifications (only if assigning)
        let assigneeUser = null;
        if (assigneeId) {
          const { data: userData } = await adminSupabase
            .from('users')
            .select('id, name, email')
            .eq('id', assigneeId)
            .single();
          assigneeUser = userData;
        }

        // Update assignee
        const { data: updatedTasks, error: updateError } = await adminSupabase
          .from('project_tasks')
          .update({ assignee_id: assigneeId })
          .in('id', taskIds)
          .eq('project_id', params.id)
          .select('id, title, assignee_id');

        if (updateError) {
          logger.error('[Bulk Tasks] Error reassigning tasks:', updateError);
          return internalError('Failed to reassign tasks', { error: updateError.message });
        }

        // Send email notifications for reassignment (only if assigning to someone)
        if (assigneeUser && project && assigneeId) {
          const taskTitles = updatedTasks?.map(t => t.title).join(', ') || '';
          const taskLink = `${getAppUrl()}/project/${params.id}`;
          
          // Send email for each task (or combine titles)
          sendTaskAssignedEmail(
            assigneeId,
            taskTitles || 'Multiple tasks',
            project.name,
            'System', // assignerName - using 'System' for bulk operations
            taskLink
          ).catch((err) => {
            logger.error('[Bulk Tasks] Error sending assignment email:', err);
          });
        }

        result = {
          operation: 'reassign',
          count: taskIds.length,
          taskIds,
          assignee_id: assigneeId,
        };
        break;
      }

      case 'status': {
        // Validate status value
        const validStatuses = ['todo', 'in_progress', 'done', 'blocked', 'archived'];
        if (!validStatuses.includes(value)) {
          return badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Update status
        const { data: updatedTasks, error: updateError } = await adminSupabase
          .from('project_tasks')
          .update({ status: value })
          .in('id', taskIds)
          .eq('project_id', params.id)
          .select('id, title, assignee_id, status');

        if (updateError) {
          logger.error('[Bulk Tasks] Error updating task status:', updateError);
          return internalError('Failed to update task status', { error: updateError.message });
        }

        // Send email notifications for status changes
        if (project && updatedTasks) {
          const assigneeIds = new Set(updatedTasks.map(t => t.assignee_id).filter(Boolean));
          
          assigneeIds.forEach((assigneeId) => {
            if (assigneeId) {
              const userTasks = updatedTasks.filter(t => t.assignee_id === assigneeId);
              const taskTitles = userTasks.map(t => t.title).join(', ');
              const taskLink = `${getAppUrl()}/project/${params.id}`;
              
              sendTaskUpdatedEmail(
                assigneeId,
                taskTitles,
                project.name,
                `Status changed to ${value}`,
                taskLink
              ).catch((err) => {
                logger.error('[Bulk Tasks] Error sending status update email:', err);
              });
            }
          });
        }

        result = {
          operation: 'status',
          count: taskIds.length,
          taskIds,
          status: value,
        };
        break;
      }

      case 'priority': {
        // Validate priority value
        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (!validPriorities.includes(value)) {
          return badRequest(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
        }

        // Update priority
        const { data: updatedTasks, error: updateError } = await adminSupabase
          .from('project_tasks')
          .update({ priority: value })
          .in('id', taskIds)
          .eq('project_id', params.id)
          .select('id, title, assignee_id, priority');

        if (updateError) {
          logger.error('[Bulk Tasks] Error updating task priority:', updateError);
          return internalError('Failed to update task priority', { error: updateError.message });
        }

        // Send email notifications for priority changes
        if (project && updatedTasks) {
          const assigneeIds = new Set(updatedTasks.map(t => t.assignee_id).filter(Boolean));
          
          assigneeIds.forEach((assigneeId) => {
            if (assigneeId) {
              const userTasks = updatedTasks.filter(t => t.assignee_id === assigneeId);
              const taskTitles = userTasks.map(t => t.title).join(', ');
              const taskLink = `${getAppUrl()}/project/${params.id}`;
              
              sendTaskUpdatedEmail(
                assigneeId,
                taskTitles,
                project.name,
                `Priority changed to ${value}`,
                taskLink
              ).catch((err) => {
                logger.error('[Bulk Tasks] Error sending priority update email:', err);
              });
            }
          });
        }

        result = {
          operation: 'priority',
          count: taskIds.length,
          taskIds,
          priority: value,
        };
        break;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/tasks/bulk:', error);
    return internalError('Failed to perform bulk operation', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

