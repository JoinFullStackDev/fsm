import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/users
 * Get all users across all organizations (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get query parameters for pagination and sorting
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '25');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search') || '';

    // Build query
    let query = adminClient
      .from('users')
      .select(`
        *,
        organizations!users_organization_id_fkey (
          id,
          name,
          slug
        )
      `);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Get total count for pagination (with search filter if applicable)
    let countQuery = adminClient.from('users').select('*', { count: 'exact', head: true });
    if (search) {
      countQuery = countQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { count, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting users:', countError);
    }

    // Apply pagination
    const from = page * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: users, error: usersError } = await query;

    if (usersError) {
      logger.error('[Global Admin Users] Error fetching users:', usersError);
      return internalError('Failed to fetch users', { error: usersError.message });
    }

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error; // Already a NextResponse error from requireSuperAdmin
    }
    logger.error('[Global Admin Users] Unexpected error:', error);
    return internalError('Failed to fetch users', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

