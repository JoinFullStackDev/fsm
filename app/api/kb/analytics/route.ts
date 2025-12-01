import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import type { AnalyticsStats } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/analytics
 * Get analytics data for knowledge base
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view analytics');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const organizationId = userData.organization_id;

    // Check KB access
    if (organizationId) {
      const hasAccess = await hasKnowledgeBaseAccess(supabase, organizationId);
      if (!hasAccess) {
        return forbidden('Knowledge base is not enabled for your organization');
      }
    }

    // Only admins and PMs can view analytics
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can view analytics');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const articleId = searchParams.get('article_id');

    // Build date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Build analytics query
    let analyticsQuery = supabase
      .from('knowledge_base_analytics')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Filter by article if specified
    if (articleId) {
      analyticsQuery = analyticsQuery.eq('article_id', articleId);
    } else if (organizationId) {
      // Filter by organization's articles
      const { data: orgArticles } = await supabase
        .from('knowledge_base_articles')
        .select('id')
        .eq('organization_id', organizationId);

      if (orgArticles && orgArticles.length > 0) {
        const articleIds = orgArticles.map(a => a.id);
        analyticsQuery = analyticsQuery.in('article_id', articleIds);
      } else {
        // No articles, return empty stats
        return NextResponse.json({
          total_views: 0,
          total_searches: 0,
          total_ai_queries: 0,
          helpful_ratings: 0,
          unhelpful_ratings: 0,
          total_exports: 0,
          top_articles: [],
          search_queries: [],
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        });
      }
    }

    const { data: analytics, error } = await analyticsQuery;

    if (error) {
      logger.error('[KB Analytics API] Error fetching analytics:', error);
      return internalError('Failed to fetch analytics', { error: error.message });
    }

    // Calculate stats
    const stats: AnalyticsStats = {
      total_views: analytics?.filter((a: any) => a.action_type === 'view').length || 0,
      total_searches: analytics?.filter((a: any) => a.action_type === 'search').length || 0,
      total_ai_queries: analytics?.filter((a: any) => a.action_type === 'ai_query').length || 0,
      helpful_ratings: analytics?.filter((a: any) => a.action_type === 'helpful').length || 0,
      unhelpful_ratings: analytics?.filter((a: any) => a.action_type === 'unhelpful').length || 0,
      total_exports: analytics?.filter((a: any) => a.action_type === 'export').length || 0,
      top_articles: [],
      search_queries: [],
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };

    // Calculate top articles by views
    const articleViews = new Map<string, number>();
    analytics?.forEach((a: any) => {
      if (a.action_type === 'view' && a.article_id) {
        articleViews.set(a.article_id, (articleViews.get(a.article_id) || 0) + 1);
      }
    });

    const topArticleIds = Array.from(articleViews.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    if (topArticleIds.length > 0) {
      const { data: topArticles } = await supabase
        .from('knowledge_base_articles')
        .select('id, title')
        .in('id', topArticleIds);

      if (topArticles) {
        stats.top_articles = topArticles.map((article: any) => ({
          article_id: article.id,
          article_title: article.title,
          views: articleViews.get(article.id) || 0,
        }));
      }
    }

    // Extract search queries
    const searchQueries = new Map<string, number>();
    analytics?.forEach((a: any) => {
      if (a.action_type === 'search' && a.metadata?.query) {
        const query = a.metadata.query.toLowerCase().trim();
        searchQueries.set(query, (searchQueries.get(query) || 0) + 1);
      }
    });

    stats.search_queries = Array.from(searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('[KB Analytics API] Exception in GET:', error);
    return internalError('Failed to fetch analytics');
  }
}

