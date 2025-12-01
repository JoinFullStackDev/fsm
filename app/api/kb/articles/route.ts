import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { generateAndStoreEmbedding } from '@/lib/kb/embeddings';
import { notifyArticlePublished } from '@/lib/notifications';
import logger from '@/lib/utils/logger';
import type { ArticleCreateInput } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/articles
 * List articles with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view articles');
    }

    // Get user record via API to avoid RLS recursion
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      // Try admin client as fallback
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

    const organizationId = userData.organization_id;

    // Check KB access
    if (organizationId) {
      const hasAccess = await hasKnowledgeBaseAccess(supabase, organizationId);
      if (!hasAccess) {
        return forbidden('Knowledge base is not enabled for your organization');
      }
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const tags = searchParams.get('tags')?.split(',');
    const published = searchParams.get('published');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeGlobal = searchParams.get('include_global') !== 'false';

    // Published filter - admins and PMs can see unpublished
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    const publishedFilter = published === 'true' || (!isAdminOrPM && published !== 'false');

    // Build base query filters (reusable for both data and count)
    const buildBaseQuery = (baseQuery: any) => {
      let q = baseQuery;

      // Filter by organization
      if (organizationId) {
        if (includeGlobal) {
          q = q.or(`organization_id.eq.${organizationId},organization_id.is.null`);
        } else {
          q = q.eq('organization_id', organizationId);
        }
      } else {
        q = q.is('organization_id', null);
      }

      // Apply filters
      if (categoryId) {
        q = q.eq('category_id', categoryId);
      }

      if (tags && tags.length > 0) {
        q = q.contains('tags', tags);
      }

      // Published filter
      if (publishedFilter) {
        q = q.eq('published', true);
      } else if (published === 'false' && isAdminOrPM) {
        q = q.eq('published', false);
      }

      return q;
    };

    // Build data query
    let dataQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .order('created_at', { ascending: false });

    dataQuery = buildBaseQuery(dataQuery);
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    // Build count query
    let countQuery = supabase
      .from('knowledge_base_articles')
      .select('id', { count: 'exact', head: true });

    countQuery = buildBaseQuery(countQuery);

    // Execute both queries in parallel
    const [{ data: articles, error }, { count, error: countError }] = await Promise.all([
      dataQuery,
      countQuery,
    ]);

    if (error) {
      logger.error('[KB Articles API] Error fetching articles:', error);
      return internalError('Failed to fetch articles', { error: error.message });
    }

    if (countError) {
      logger.warn('[KB Articles API] Error getting count:', countError);
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
    logger.error('[KB Articles API] Exception in GET:', error);
    return internalError('Failed to fetch articles');
  }
}

/**
 * POST /api/kb/articles
 * Create a new article
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to create articles');
    }

    // Get user record via API to avoid RLS recursion
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      // Try admin client as fallback
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

    const organizationId = userData.organization_id;

    // Check KB access and access level
    if (organizationId) {
      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel === 'none' || accessLevel === 'read_global' || accessLevel === 'read_all' || accessLevel === 'read_ai') {
        return forbidden('You do not have permission to create articles');
      }
    } else {
      // Only super admins can create global articles
      if (userData.role !== 'admin' || !userData.is_super_admin) {
        return forbidden('Only super admins can create global articles');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can create articles');
    }

    const body: ArticleCreateInput = await request.json();
    const { title, slug, summary, body: articleBody, tags, category_id, metadata, published } = body;

    // Validate required fields
    if (!title || !articleBody) {
      return badRequest('Title and body are required');
    }

    // Generate slug if not provided
    const articleSlug = slug || generateSlug(title);

    // Check for duplicate slug
    let duplicateCheck = supabase
      .from('knowledge_base_articles')
      .select('id')
      .eq('slug', articleSlug);

    if (organizationId) {
      duplicateCheck = duplicateCheck.eq('organization_id', organizationId);
    } else {
      duplicateCheck = duplicateCheck.is('organization_id', null);
    }

    const { data: existing } = await duplicateCheck.single();

    if (existing) {
      return badRequest('An article with this slug already exists');
    }

    // Create article
    const articleData: any = {
      organization_id: organizationId,
      title,
      slug: articleSlug,
      summary: summary || null,
      body: articleBody,
      tags: tags || [],
      category_id: category_id || null,
      metadata: metadata || {},
      published: published || false,
      created_by: userData.id,
      updated_by: userData.id,
    };

    const { data: article, error: createError } = await supabase
      .from('knowledge_base_articles')
      .insert(articleData)
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .single();

    if (createError) {
      logger.error('[KB Articles API] Error creating article:', createError);
      return internalError('Failed to create article', { error: createError.message });
    }

    // Generate and store embedding (async, non-blocking)
    generateAndStoreEmbedding(supabase, article.id, {
      title,
      summary: summary || null,
      body: articleBody,
    }).catch((err) => {
      logger.error('[KB Articles API] Error generating embedding:', err);
      // Don't fail the request if embedding generation fails
    });

    // Send notification if published
    if (published) {
      const { data: author } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      notifyArticlePublished(
        organizationId,
        article.id,
        title,
        userData.id,
        author?.name || null
      ).catch((err) => {
        logger.error('[KB Articles API] Error sending notification:', err);
      });
    }

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    logger.error('[KB Articles API] Exception in POST:', error);
    return internalError('Failed to create article');
  }
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

