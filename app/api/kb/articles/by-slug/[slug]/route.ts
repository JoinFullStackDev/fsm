import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/articles/by-slug/[slug]
 * Get article by slug (handles both org-specific and global slugs)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view articles');
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
        return unauthorized('Knowledge base is not enabled for your organization');
      }
    }

    // Try to find article by slug
    // First try org-specific, then global
    let articleQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('slug', params.slug);

    // If user has an org, try org-specific first, then global
    if (organizationId) {
      articleQuery = articleQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      // No org, only global
      articleQuery = articleQuery.is('organization_id', null);
    }

    const { data: articles, error: articlesError } = await articleQuery;

    if (articlesError) {
      logger.error('[KB Articles API] Error fetching article by slug:', articlesError);
      return internalError('Failed to fetch article', { error: articlesError.message });
    }

    if (!articles || articles.length === 0) {
      return notFound('Article not found');
    }

    // If multiple articles found (org + global), prefer org-specific
    const article = organizationId && articles.length > 1
      ? articles.find((a: any) => a.organization_id === organizationId) || articles[0]
      : articles[0];

    // Check access
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!article.published && !isAdminOrPM) {
      return notFound('Article not found');
    }

    // Track view analytics (non-blocking)
    trackArticleView(supabase, article.id, userData.id).catch((err) => {
      logger.error('[KB Articles API] Error tracking view:', err);
    });

    return NextResponse.json(article);
  } catch (error) {
    logger.error('[KB Articles API] Exception in GET by slug:', error);
    return internalError('Failed to fetch article');
  }
}

/**
 * Track article view for analytics
 */
async function trackArticleView(
  supabase: any,
  articleId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('knowledge_base_analytics')
    .insert({
      article_id: articleId,
      user_id: userId,
      action_type: 'view',
    });
}

