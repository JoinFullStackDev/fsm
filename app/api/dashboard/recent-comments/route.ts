import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/recent-comments
 * Get recent comments on tasks assigned to the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view comments');
    }

    // Get user's database ID using admin client to bypass RLS
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: dbUserError } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (dbUserError || !userData) {
      logger.error('[Recent Comments API] User not found:', dbUserError);
      return unauthorized('User not found');
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Fetch recent comments on tasks assigned to this user
    // Join with project_tasks to get task info and verify assignee
    // Join with projects to get project name and verify organization
    const { data: comments, error: commentsError } = await adminClient
      .from('task_comments')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        task_id,
        user:users!task_comments_user_id_fkey(
          id,
          name,
          email,
          avatar_url
        ),
        task:project_tasks!task_comments_task_id_fkey(
          id,
          title,
          assignee_id,
          project_id,
          project:projects!project_tasks_project_id_fkey(
            id,
            name,
            organization_id
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Fetch extra to account for filtering

    if (commentsError) {
      logger.error('[Recent Comments API] Error fetching comments:', commentsError);
      return internalError('Failed to fetch comments', { error: commentsError.message });
    }

    // Filter comments to only those on tasks assigned to this user
    // and belonging to user's organization
    const filteredComments = (comments || [])
      .filter((comment) => {
        // Handle Supabase nested relations (can be array or object)
        const task = Array.isArray(comment.task) ? comment.task[0] : comment.task;
        if (!task) return false;

        // Check if task is assigned to current user
        if (task.assignee_id !== userData.id) return false;

        // Check organization
        const project = Array.isArray(task.project) ? task.project[0] : task.project;
        if (!project) return false;
        if (project.organization_id !== userData.organization_id) return false;

        return true;
      })
      .slice(0, limit)
      .map((comment) => {
        // Normalize the nested relations for consistent response
        const task = Array.isArray(comment.task) ? comment.task[0] : comment.task;
        const project = task ? (Array.isArray(task.project) ? task.project[0] : task.project) : null;
        const commenter = Array.isArray(comment.user) ? comment.user[0] : comment.user;

        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          task_id: comment.task_id,
          commenter: commenter ? {
            id: commenter.id,
            name: commenter.name,
            email: commenter.email,
            avatar_url: commenter.avatar_url,
          } : null,
          task: task ? {
            id: task.id,
            title: task.title,
            project_id: task.project_id,
          } : null,
          project: project ? {
            id: project.id,
            name: project.name,
          } : null,
        };
      });

    const response = NextResponse.json({
      comments: filteredComments,
      count: filteredComments.length,
    });

    // Add cache headers
    response.headers.set('Cache-Control', 'private, max-age=30');
    return response;
  } catch (error) {
    logger.error('[Recent Comments API] Unexpected error:', error);
    return internalError('Failed to fetch comments', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

