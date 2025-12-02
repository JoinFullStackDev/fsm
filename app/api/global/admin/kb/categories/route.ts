import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/kb/categories
 * Get all categories across all organizations (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeArticleCounts = searchParams.get('include_counts') === 'true';

    // Build query
    let query = adminClient
      .from('knowledge_base_categories')
      .select('*')
      .order('name', { ascending: true });

    const { data: categories, error } = await query;

    if (error) {
      logger.error('[Global Admin KB Categories] Error fetching categories:', error);
      return internalError('Failed to fetch categories', { error: error.message });
    }

    // Build hierarchical structure
    const categoryMap = new Map<string, any>();
    const rootCategories: any[] = [];

    (categories || []).forEach((category: any) => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
        article_count: 0,
      });
    });

    // Get article counts if requested
    if (includeArticleCounts && categoryMap.size > 0) {
      const categoryIds = Array.from(categoryMap.keys());
      const { data: articles } = await adminClient
        .from('knowledge_base_articles')
        .select('category_id')
        .in('category_id', categoryIds);

      const counts = new Map<string, number>();
      (articles || []).forEach((article: any) => {
        if (article.category_id) {
          counts.set(article.category_id, (counts.get(article.category_id) || 0) + 1);
        }
      });

      counts.forEach((count, category_id) => {
        const category = categoryMap.get(category_id);
        if (category) {
          category.article_count = count;
        }
      });
    }

    // Build hierarchy
    categoryMap.forEach((category) => {
      if (category.parent_id && categoryMap.has(category.parent_id)) {
        const parent = categoryMap.get(category.parent_id);
        parent.children.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    return NextResponse.json({
      categories: rootCategories,
      flat: Array.from(categoryMap.values()),
    });
  } catch (error) {
    logger.error('[Global Admin KB Categories] Exception:', error);
    return internalError('Failed to fetch categories');
  }
}
