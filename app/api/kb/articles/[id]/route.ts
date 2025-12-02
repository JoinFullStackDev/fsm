import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { updateEmbeddingIfChanged, generateAndStoreEmbedding } from '@/lib/kb/embeddings';
import { notifyArticleUpdated, notifyArticlePublished } from '@/lib/notifications';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { ArticleUpdateInput } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/articles/[id]
 * Get an article by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Get article
    const { data: article, error: fetchError } = await supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('id', params.id)
      .single();

    if (fetchError || !article) {
      return notFound('Article not found');
    }

    // Check access - allow if:
    // 1. User is super admin
    // 2. Article is global (organization_id is null)
    // 3. Article belongs to user's organization
    if (article.organization_id !== organizationId) {
      if (article.organization_id !== null || !userData.is_super_admin) {
        // For non-super-admins, check if article is published and they have KB access
        if (!article.published) {
          return forbidden('You do not have permission to view this article');
        }
        
        // Check KB access for viewing published articles
        if (organizationId) {
          const { hasKnowledgeBaseAccess } = await import('@/lib/packageLimits');
          const hasAccess = await hasKnowledgeBaseAccess(supabase, organizationId);
          if (!hasAccess) {
            return forbidden('Knowledge base is not enabled for your organization');
          }
        }
      }
    }

    return NextResponse.json(article);
  } catch (error) {
    logger.error('[KB Articles API] Exception in GET:', error);
    return internalError('Failed to fetch article');
  }
}

/**
 * PUT /api/kb/articles/[id]
 * Update an article
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to update articles');
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

    // Check KB access level
    if (organizationId) {
      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel === 'none' || accessLevel === 'read_global' || accessLevel === 'read_all' || accessLevel === 'read_ai') {
        return forbidden('You do not have permission to update articles');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can update articles');
    }

    // Get existing article
    const { data: existingArticle, error: fetchError } = await supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingArticle) {
      return notFound('Article not found');
    }

    // Check organization access
    if (existingArticle.organization_id !== organizationId) {
      if (existingArticle.organization_id !== null || !userData.is_super_admin) {
        return forbidden('You do not have permission to update this article');
      }
    }

    const body: ArticleUpdateInput = await request.json();
    const { title, slug, summary, body: articleBody, tags, category_id, metadata, published } = body;

    // Build update data
    const updateData: any = {
      updated_by: userData.id,
    };

    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (summary !== undefined) updateData.summary = summary;
    if (articleBody !== undefined) updateData.body = articleBody;
    if (tags !== undefined) updateData.tags = tags;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (published !== undefined) updateData.published = published;

    // Check for duplicate slug if slug is being changed
    if (slug && slug !== existingArticle.slug) {
      let duplicateCheck = supabase
        .from('knowledge_base_articles')
        .select('id')
        .eq('slug', slug)
        .neq('id', params.id);

      if (organizationId) {
        duplicateCheck = duplicateCheck.eq('organization_id', organizationId);
      } else {
        duplicateCheck = duplicateCheck.is('organization_id', null);
      }

      const { data: existing } = await duplicateCheck.single();

      if (existing) {
        return badRequest('An article with this slug already exists');
      }
    }

    // Update article
    const { data: updatedArticle, error: updateError } = await supabase
      .from('knowledge_base_articles')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .single();

    if (updateError) {
      logger.error('[KB Articles API] Error updating article:', updateError);
      return internalError('Failed to update article', { error: updateError.message });
    }

    // Update embedding if content changed
    if (title !== undefined || summary !== undefined || articleBody !== undefined) {
      const oldContent = {
        title: existingArticle.title,
        summary: existingArticle.summary,
        body: existingArticle.body,
      };
      const newContent = {
        title: title !== undefined ? title : existingArticle.title,
        summary: summary !== undefined ? summary : existingArticle.summary,
        body: articleBody !== undefined ? articleBody : existingArticle.body,
      };

      updateEmbeddingIfChanged(supabase, params.id, oldContent, newContent).catch((err) => {
        logger.error('[KB Articles API] Error updating embedding:', err);
      });
    }

    // Create version if content changed significantly
    if (title !== undefined || articleBody !== undefined) {
      const adminClient = createAdminSupabaseClient();
      // Get current max version number
      const { data: maxVersion } = await adminClient
        .from('knowledge_base_versions')
        .select('version_number')
        .eq('article_id', params.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = (maxVersion?.version_number || 0) + 1;

      try {
        await adminClient
          .from('knowledge_base_versions')
          .insert({
            article_id: params.id,
            version_number: nextVersion,
            title: updatedArticle.title,
            body: updatedArticle.body,
            created_by: userData.id,
          });
      } catch (err) {
        logger.error('[KB Articles API] Error creating version:', err);
        // Don't fail the request if version creation fails
      }
    }

    // Send notifications
    const wasPublished = existingArticle.published;
    const nowPublished = updatedArticle.published;

    if (nowPublished && !wasPublished) {
      // Article was just published
      const { data: author } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      notifyArticlePublished(
        updatedArticle.organization_id,
        params.id,
        updatedArticle.title,
        userData.id,
        author?.name || null
      ).catch((err) => {
        logger.error('[KB Articles API] Error sending publish notification:', err);
      });
    } else if (nowPublished && wasPublished) {
      // Article was updated (and is published)
      const { data: updater } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      notifyArticleUpdated(
        updatedArticle.organization_id,
        params.id,
        updatedArticle.title,
        userData.id,
        updater?.name || null
      ).catch((err) => {
        logger.error('[KB Articles API] Error sending update notification:', err);
      });
    }

    return NextResponse.json(updatedArticle);
  } catch (error) {
    logger.error('[KB Articles API] Exception in PUT:', error);
    return internalError('Failed to update article');
  }
}

/**
 * DELETE /api/kb/articles/[id]
 * Delete an article
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to delete articles');
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

    // Check KB access level
    if (organizationId) {
      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel === 'none' || accessLevel === 'read_global' || accessLevel === 'read_all' || accessLevel === 'read_ai') {
        return forbidden('You do not have permission to delete articles');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can delete articles');
    }

    // Get existing article
    const { data: existingArticle, error: fetchError } = await supabase
      .from('knowledge_base_articles')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingArticle) {
      return notFound('Article not found');
    }

    // Check organization access
    if (existingArticle.organization_id !== organizationId) {
      if (existingArticle.organization_id !== null || !userData.is_super_admin) {
        return forbidden('You do not have permission to delete this article');
      }
    }

    // Delete article (cascade will handle versions and analytics)
    const { error: deleteError } = await supabase
      .from('knowledge_base_articles')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('[KB Articles API] Error deleting article:', deleteError);
      return internalError('Failed to delete article', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[KB Articles API] Exception in DELETE:', error);
    return internalError('Failed to delete article');
  }
}

