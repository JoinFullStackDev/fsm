import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError, forbidden } from '@/lib/utils/apiErrors';
import { generateAndStoreEmbedding } from '@/lib/kb/embeddings';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kb/articles/generate-embeddings
 * Generate embeddings for articles that don't have them yet
 * Admin/PM only endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        return unauthorized('User record not found');
      }
      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM) {
      return forbidden('Only admins and PMs can generate embeddings');
    }

    const body = await request.json().catch(() => ({}));
    const { article_id, limit = 10 } = body;

    // Use admin client to bypass RLS for fetching articles
    const adminClient = createAdminSupabaseClient();

    let articlesQuery = adminClient
      .from('knowledge_base_articles')
      .select('id, title, summary, body, vector')
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

