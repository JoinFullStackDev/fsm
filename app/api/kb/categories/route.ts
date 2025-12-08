import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { notifyCategoryAdded } from '@/lib/notifications';
import logger from '@/lib/utils/logger';
import type { CategoryCreateInput } from '@/types/kb';
import type { SupabaseClient } from '@supabase/supabase-js';

// Types for KB categories
interface KBCategory {
  id: string;
  name: string;
  slug: string;
  organization_id: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface KBCategoryWithChildren extends KBCategory {
  children: KBCategoryWithChildren[];
  article_count: number;
}

interface KBArticle {
  category_id: string | null;
}

interface CategoryInsertData {
  organization_id: string | null;
  name: string;
  slug: string;
  parent_id: string | null;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/categories
 * List categories (hierarchical)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view categories');
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
    const includeGlobal = searchParams.get('include_global') !== 'false';
    const includeArticleCounts = searchParams.get('include_counts') === 'true';

    // Build query
    let query = supabase
      .from('knowledge_base_categories')
      .select('*')
      .order('name', { ascending: true });

    // Filter by organization
    if (organizationId) {
      if (includeGlobal) {
        // Include org categories and global categories
        query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      } else {
        // Only org categories
        query = query.eq('organization_id', organizationId);
      }
    } else {
      // Only global categories
      query = query.is('organization_id', null);
    }

    const { data: categories, error } = await query;

    if (error) {
      logger.error('[KB Categories API] Error fetching categories:', error);
      return internalError('Failed to fetch categories', { error: error.message });
    }

    // Build hierarchical structure
    const categoryMap = new Map<string, KBCategoryWithChildren>();
    const rootCategories: KBCategoryWithChildren[] = [];

    (categories || []).forEach((category: KBCategory) => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
        article_count: 0,
      });
    });

    // Get article counts if requested
    if (includeArticleCounts) {
      const articleCounts = await getArticleCounts(supabase, Array.from(categoryMap.keys()));
      articleCounts.forEach(({ category_id, count }) => {
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
        if (parent) {
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return NextResponse.json({
      categories: rootCategories,
    });
  } catch (error) {
    logger.error('[KB Categories API] Exception in GET:', error);
    return internalError('Failed to fetch categories');
  }
}

/**
 * POST /api/kb/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to create categories');
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

    // Check KB access level
    if (organizationId) {
      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel === 'none' || accessLevel === 'read_global' || accessLevel === 'read_all' || accessLevel === 'read_ai') {
        return forbidden('You do not have permission to create categories');
      }
    } else {
      // Only super admins can create global categories
      if (userData.role !== 'admin' || !userData.is_super_admin) {
        return forbidden('Only super admins can create global categories');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can create categories');
    }

    const body: CategoryCreateInput = await request.json();
    const { name, slug, parent_id } = body;

    // Validate required fields
    if (!name) {
      return badRequest('Category name is required');
    }

    // Generate slug if not provided
    const categorySlug = slug || generateSlug(name);

    // Check for duplicate slug
    let duplicateCheck = supabase
      .from('knowledge_base_categories')
      .select('id')
      .eq('slug', categorySlug);

    if (organizationId) {
      duplicateCheck = duplicateCheck.eq('organization_id', organizationId);
    } else {
      duplicateCheck = duplicateCheck.is('organization_id', null);
    }

    const { data: existing } = await duplicateCheck.single();

    if (existing) {
      return badRequest('A category with this slug already exists');
    }

    // Validate parent_id if provided
    if (parent_id) {
      const { data: parentCategory, error: parentError } = await supabase
        .from('knowledge_base_categories')
        .select('organization_id')
        .eq('id', parent_id)
        .single();

      if (parentError || !parentCategory) {
        return badRequest('Parent category not found');
      }

      // Parent must be in same organization or global
      if (parentCategory.organization_id !== organizationId) {
        if (parentCategory.organization_id !== null || organizationId !== null) {
          return badRequest('Parent category must be in the same organization');
        }
      }
    }

    // Create category
    const categoryData: CategoryInsertData = {
      organization_id: organizationId,
      name,
      slug: categorySlug,
      parent_id: parent_id || null,
    };

    const { data: category, error: createError } = await supabase
      .from('knowledge_base_categories')
      .insert(categoryData)
      .select()
      .single();

    if (createError) {
      logger.error('[KB Categories API] Error creating category:', createError);
      return internalError('Failed to create category', { error: createError.message });
    }

    // Send notification
    const { data: creator } = await supabase
      .from('users')
      .select('name')
      .eq('id', userData.id)
      .single();

    notifyCategoryAdded(
      organizationId,
      category.id,
      category.name,
      userData.id,
      creator?.name || null
    ).catch((err) => {
      logger.error('[KB Categories API] Error sending notification:', err);
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    logger.error('[KB Categories API] Exception in POST:', error);
    return internalError('Failed to create category');
  }
}

/**
 * Get article counts per category
 */
async function getArticleCounts(
  supabase: SupabaseClient,
  categoryIds: string[]
): Promise<Array<{ category_id: string; count: number }>> {
  try {
    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .select('category_id')
      .in('category_id', categoryIds);

    if (error) {
      logger.error('[KB Categories API] Error getting article counts:', error);
      return [];
    }

    const counts = new Map<string, number>();
    ((data || []) as KBArticle[]).forEach((article: KBArticle) => {
      if (article.category_id) {
        counts.set(article.category_id, (counts.get(article.category_id) || 0) + 1);
      }
    });

    return Array.from(counts.entries()).map(([category_id, count]) => ({
      category_id,
      count,
    }));
  } catch (error) {
    logger.error('[KB Categories API] Exception getting article counts:', error);
    return [];
  }
}

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

