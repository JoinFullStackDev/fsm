import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { PAGINATION_DEFAULTS } from '@/lib/constants';
import type { ExportListResponse, ExportWithUser } from '@/types/project';

/**
 * GET /api/projects/[id]/exports
 * 
 * Fetches export history for a project with filtering, pagination, and search.
 * Requires authentication and project membership.
 * 
 * Query Parameters:
 * - export_type: Filter by export type (blueprint_bundle, cursor_bundle, prd)
 * - start_date: Filter exports from this date (ISO format: YYYY-MM-DD)
 * - end_date: Filter exports until this date (ISO format: YYYY-MM-DD)
 * - limit: Number of results per page (default: 20)
 * - offset: Pagination offset (default: 0)
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing project ID
 * @returns Export list with pagination metadata
 * 
 * @example
 * GET /api/projects/123/exports?export_type=blueprint_bundle&limit=10&offset=0
 * Response: { exports: [...], total: 25, limit: 10, offset: 0 }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view export history');
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

    // Verify user has access to project (owner or member)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Check if user is owner or member
    const isOwner = project.owner_id === userData.id;
    const { data: membership } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', userData.id)
      .single();

    if (!isOwner && !membership) {
      return forbidden('You do not have access to this project');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('export_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULTS.LIMIT));
    const offset = parseInt(searchParams.get('offset') || String(PAGINATION_DEFAULTS.OFFSET));

    // Build query - use left join for user data
    let query = supabase
      .from('exports')
      .select(`
        *,
        user:users!exports_user_id_fkey (
          id,
          name,
          email
        )
      `, { count: 'exact' })
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // If foreign key doesn't exist, we'll handle it gracefully
    // Fallback: query exports first, then fetch users separately if needed

    // Apply filters
    if (exportType) {
      query = query.eq('export_type', exportType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      // Add one day to include the entire end date
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      query = query.lt('created_at', endDatePlusOne.toISOString());
    }

    let exportsData: any[] = [];
    let totalCount = 0;
    let queryError: any = null;

    try {
      const result = await query;
      exportsData = result.data || [];
      totalCount = result.count || 0;
      queryError = result.error;
    } catch (err) {
      // If join fails (foreign key might not exist), try without join
      logger.warn('Join query failed, trying without user join:', err);
      const simpleQuery = supabase
        .from('exports')
        .select('*', { count: 'exact' })
        .eq('project_id', params.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (exportType) {
        simpleQuery.eq('export_type', exportType);
      }
      if (startDate) {
        simpleQuery.gte('created_at', startDate);
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        simpleQuery.lt('created_at', endDatePlusOne.toISOString());
      }

      const result = await simpleQuery;
      exportsData = result.data || [];
      totalCount = result.count || 0;
      queryError = result.error;
    }

    if (queryError) {
      logger.error('Error loading exports:', queryError);
      return internalError('Failed to load export history', { error: queryError.message });
    }

    // If we have user_ids, fetch user data separately
    const userIds = exportsData
      .map((exp) => exp.user_id)
      .filter((id): id is string => !!id);
    
    let usersMap: Record<string, { id: string; name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);
      
      if (users) {
        users.forEach((user) => {
          usersMap[user.id] = {
            id: user.id,
            name: user.name || 'Unknown',
            email: user.email,
          };
        });
      }
    }

    // Transform data to match ExportWithUser type
    const exportsWithUser: ExportWithUser[] = exportsData.map((exp: any) => ({
      id: exp.id,
      project_id: exp.project_id,
      export_type: exp.export_type,
      storage_path: exp.storage_path,
      user_id: exp.user_id,
      file_size: exp.file_size,
      created_at: exp.created_at,
      user: exp.user
        ? {
            id: exp.user.id,
            name: exp.user.name,
            email: exp.user.email,
          }
        : exp.user_id && usersMap[exp.user_id]
        ? usersMap[exp.user_id]
        : undefined,
    }));

    const response: ExportListResponse = {
      exports: exportsWithUser,
      total: totalCount,
      limit,
      offset,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/exports:', error);
    return internalError('Failed to load export history', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

