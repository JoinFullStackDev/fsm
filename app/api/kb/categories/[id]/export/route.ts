import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess } from '@/lib/packageLimits';
import { generateCategoryZIP } from '@/lib/kb/export';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kb/categories/[id]/export
 * Export category as ZIP (all articles in category)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to export categories');
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

    // Get category
    const { data: category, error: categoryError } = await supabase
      .from('knowledge_base_categories')
      .select('*')
      .eq('id', params.id)
      .single();

    if (categoryError || !category) {
      return notFound('Category not found');
    }

    // Check organization access
    if (category.organization_id !== organizationId) {
      if (category.organization_id !== null || !userData.is_super_admin) {
        return forbidden('You do not have access to this category');
      }
    }

    // Get articles in category
    let articlesQuery = supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('category_id', params.id)
      .eq('published', true);

    if (organizationId) {
      articlesQuery = articlesQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      articlesQuery = articlesQuery.is('organization_id', null);
    }

    const { data: articles, error: articlesError } = await articlesQuery;

    if (articlesError) {
      logger.error('[KB Export ZIP] Error fetching articles:', articlesError);
      return internalError('Failed to fetch articles', { error: articlesError.message });
    }

    if (!articles || articles.length === 0) {
      return notFound('No articles found in this category');
    }

    // Generate ZIP
    const articleContents = new Map<string, string>();
    articles.forEach(article => {
      articleContents.set(article.id, article.body);
    });

    const zipBuffer = await generateCategoryZIP(category, articles, articleContents);

    // Record export
    try {
      const adminClient = createAdminSupabaseClient();
      await adminClient.from('exports').insert({
        project_id: null,
        export_type: 'kb_category_zip',
        storage_path: `kb/categories/${params.id}/${new Date().toISOString().split('T')[0]}.zip`,
        user_id: userData.id,
        file_size: zipBuffer.length,
      });
    } catch (err) {
      logger.error('[KB Export ZIP] Error recording export:', err);
    }

    // Track analytics
    try {
      await supabase.from('knowledge_base_analytics').insert({
        article_id: null,
        user_id: userData.id,
        action_type: 'export',
        metadata: {
          export_type: 'zip',
          category_id: params.id,
          article_count: articles.length,
        },
      });
    } catch (err) {
      logger.error('[KB Export ZIP] Error tracking analytics:', err);
    }

    // Return ZIP
    const sanitizedName = category.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedName}_articles.zip"`,
      },
    });
  } catch (error) {
    logger.error('[KB Export ZIP] Exception:', error);
    return internalError('Failed to export category as ZIP');
  }
}

