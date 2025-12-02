import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/kb/articles
 * Get all articles across all organizations (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const published = searchParams.get('published');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = adminClient
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (published !== null && published !== undefined) {
      query = query.eq('published', published === 'true');
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Get total count
    let countQuery = adminClient
      .from('knowledge_base_articles')
      .select('id', { count: 'exact', head: true });

    if (categoryId) {
      countQuery = countQuery.eq('category_id', categoryId);
    }

    if (published !== null && published !== undefined) {
      countQuery = countQuery.eq('published', published === 'true');
    }

    if (search) {
      countQuery = countQuery.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Execute queries
    const [{ data: articles, error }, { count, error: countError }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countQuery,
    ]);

    if (error) {
      logger.error('[Global Admin KB Articles] Error fetching articles:', error);
      return internalError('Failed to fetch articles', { error: error.message });
    }

    if (countError) {
      logger.warn('[Global Admin KB Articles] Error getting count:', countError);
    }

    return NextResponse.json({
      articles: articles || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
      },
    });
  } catch (error) {
    logger.error('[Global Admin KB Articles] Exception:', error);
    return internalError('Failed to fetch articles');
  }
}
