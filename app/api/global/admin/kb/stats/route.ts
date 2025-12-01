import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/kb/stats
 * Get knowledge base statistics for super admin
 */
export async function GET(request: NextRequest) {
  try {
    // Require super admin access
    await requireSuperAdmin(request);

    const adminClient = createAdminSupabaseClient();

    // Get comprehensive KB statistics
    const { data: articles, error } = await adminClient
      .from('knowledge_base_articles')
      .select('id, published, vector, organization_id');

    if (error) {
      logger.error('[KB Admin Stats] Error fetching articles:', error);
      return internalError('Failed to fetch statistics', { error: error.message });
    }

    const totalArticles = articles?.length || 0;
    const publishedArticles = articles?.filter(a => a.published).length || 0;
    const articlesWithEmbeddings = articles?.filter(a => a.published && a.vector !== null).length || 0;
    const articlesWithoutEmbeddings = articles?.filter(a => a.published && a.vector === null).length || 0;
    const globalArticles = articles?.filter(a => a.published && a.organization_id === null).length || 0;
    const orgArticles = articles?.filter(a => a.published && a.organization_id !== null).length || 0;

    return NextResponse.json({
      totalArticles,
      publishedArticles,
      articlesWithEmbeddings,
      articlesWithoutEmbeddings,
      globalArticles,
      orgArticles,
    });
  } catch (error) {
    logger.error('[KB Admin Stats] Exception:', error);
    return internalError('Failed to fetch statistics');
  }
}

