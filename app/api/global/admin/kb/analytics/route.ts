import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Types for KB analytics
interface KBAnalyticsRecord {
  action_type: string;
  article_id: string | null;
  created_at: string;
  metadata?: {
    query?: string;
    [key: string]: unknown;
  };
}

interface KBArticleBasic {
  id: string;
  title: string;
}

interface TopArticle {
  article_id: string;
  article_title: string;
  views: number;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/kb/analytics
 * Get comprehensive analytics from knowledge_base_analytics table (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const articleId = searchParams.get('article_id');

    // Build date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Build analytics query
    let analyticsQuery = adminClient
      .from('knowledge_base_analytics')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Filter by article if specified
    if (articleId) {
      analyticsQuery = analyticsQuery.eq('article_id', articleId);
    }

    const { data: analytics, error } = await analyticsQuery;

    if (error) {
      logger.error('[Global Admin KB Analytics] Error fetching analytics:', error);
      return internalError('Failed to fetch analytics', { error: error.message });
    }

    // Calculate stats
    const analyticsData = (analytics || []) as KBAnalyticsRecord[];
    const stats = {
      total_views: analyticsData.filter((a) => a.action_type === 'view').length,
      total_searches: analyticsData.filter((a) => a.action_type === 'search').length,
      total_ai_queries: analyticsData.filter((a) => a.action_type === 'ai_query').length,
      helpful_ratings: analyticsData.filter((a) => a.action_type === 'helpful').length,
      unhelpful_ratings: analyticsData.filter((a) => a.action_type === 'unhelpful').length,
      total_exports: analyticsData.filter((a) => a.action_type === 'export').length,
    };

    // Calculate top articles by views
    const articleViews = new Map<string, number>();
    analyticsData.forEach((a: KBAnalyticsRecord) => {
      if (a.action_type === 'view' && a.article_id) {
        articleViews.set(a.article_id, (articleViews.get(a.article_id) || 0) + 1);
      }
    });

    // Get article details for top articles
    const topArticleIds = Array.from(articleViews.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    let topArticles: TopArticle[] = [];
    if (topArticleIds.length > 0) {
      const { data: articles } = await adminClient
        .from('knowledge_base_articles')
        .select('id, title')
        .in('id', topArticleIds);

      topArticles = ((articles || []) as KBArticleBasic[]).map((article) => ({
        article_id: article.id,
        article_title: article.title,
        views: articleViews.get(article.id) || 0,
      }));
    }

    // Calculate search queries
    const searchQueries = new Map<string, number>();
    analyticsData.forEach((a: KBAnalyticsRecord) => {
      if (a.action_type === 'search' && a.metadata?.query) {
        const query = a.metadata.query.toLowerCase().trim();
        if (query) {
          searchQueries.set(query, (searchQueries.get(query) || 0) + 1);
        }
      }
    });

    const topSearchQueries = Array.from(searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    // Calculate daily stats for time series
    const dailyStats = new Map<string, {
      views: number;
      searches: number;
      ai_queries: number;
      helpful: number;
      unhelpful: number;
      exports: number;
    }>();

    analyticsData.forEach((a: KBAnalyticsRecord) => {
      const date = new Date(a.created_at).toISOString().split('T')[0];
      if (!dailyStats.has(date)) {
        dailyStats.set(date, {
          views: 0,
          searches: 0,
          ai_queries: 0,
          helpful: 0,
          unhelpful: 0,
          exports: 0,
        });
      }

      const dayStats = dailyStats.get(date)!;
      switch (a.action_type) {
        case 'view':
          dayStats.views++;
          break;
        case 'search':
          dayStats.searches++;
          break;
        case 'ai_query':
          dayStats.ai_queries++;
          break;
        case 'helpful':
          dayStats.helpful++;
          break;
        case 'unhelpful':
          dayStats.unhelpful++;
          break;
        case 'export':
          dayStats.exports++;
          break;
      }
    });

    // Convert to array sorted by date
    const dailyStatsArray = Array.from(dailyStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({ date, ...stats }));

    return NextResponse.json({
      ...stats,
      top_articles: topArticles,
      search_queries: topSearchQueries,
      daily_stats: dailyStatsArray,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Global Admin KB Analytics] Exception:', error);
    return internalError('Failed to fetch analytics');
  }
}
