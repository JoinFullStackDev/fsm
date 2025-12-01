import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { generateAndStoreEmbedding } from '@/lib/kb/embeddings';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kb/articles/generate-embeddings
 * Generate embeddings for articles that don't have them yet
 * Super admin only endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Require super admin access
    await requireSuperAdmin(request);

    const supabase = await createServerSupabaseClient();

    const body = await request.json().catch(() => ({}));
    const { article_id, limit = 10 } = body;

    // Use admin client to bypass RLS for fetching articles
    const adminClient = createAdminSupabaseClient();

    let articlesQuery = adminClient
      .from('knowledge_base_articles')
      .select('id, title, summary, body, vector, organization_id')
      .eq('published', true)
      .is('vector', null);

    // If specific article ID provided, generate for that one
    if (article_id) {
      articlesQuery = articlesQuery.eq('id', article_id);
    }

    // Limit number of articles to process
    articlesQuery = articlesQuery.limit(limit);

    const { data: articles, error } = await articlesQuery;

    if (error) {
      logger.error('[KB Embeddings] Error fetching articles:', error);
      return internalError('Failed to fetch articles', { error: error.message });
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        message: 'No articles found without embeddings',
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    // Generate embeddings for each article
    const results = await Promise.allSettled(
      articles.map(async (article) => {
        try {
          const success = await generateAndStoreEmbedding(
            supabase,
            article.id,
            {
              title: article.title,
              summary: article.summary,
              body: article.body,
            }
          );
          if (!success) {
            logger.error('[KB Embeddings] Failed to generate embedding for article:', article.id, article.title);
          }
          return { id: article.id, success };
        } catch (error) {
          logger.error('[KB Embeddings] Exception generating embedding for article:', article.id, error);
          return { id: article.id, success: false };
        }
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - succeeded;

    logger.info('[KB Embeddings] Batch generation complete:', {
      total: articles.length,
      succeeded,
      failed,
    });

    return NextResponse.json({
      message: `Processed ${articles.length} articles`,
      processed: articles.length,
      succeeded,
      failed,
      article_ids: articles.map((a) => a.id),
    });
  } catch (error) {
    logger.error('[KB Embeddings] Exception:', error);
    return internalError('Failed to generate embeddings');
  }
}

