import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import type { CategoryUpdateInput } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/kb/categories/[id]
 * Update a category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to update categories');
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
        return forbidden('You do not have permission to update categories');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can update categories');
    }

    // Get existing category
    const { data: existingCategory, error: fetchError } = await supabase
      .from('knowledge_base_categories')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingCategory) {
      return notFound('Category not found');
    }

    // Check organization access
    if (existingCategory.organization_id !== organizationId) {
      if (existingCategory.organization_id !== null || !userData.is_super_admin) {
        return forbidden('You do not have permission to update this category');
      }
    }

    const body: CategoryUpdateInput = await request.json();
    const { name, slug, parent_id } = body;

    // Build update data
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (parent_id !== undefined) {
      updateData.parent_id = parent_id;

      // Validate parent_id if provided
      if (parent_id) {
        const { data: parentCategory, error: parentError } = await supabase
          .from('knowledge_base_categories')
          .select('organization_id, id')
          .eq('id', parent_id)
          .single();

        if (parentError || !parentCategory) {
          return badRequest('Parent category not found');
        }

        // Prevent circular reference
        if (parent_id === params.id) {
          return badRequest('Category cannot be its own parent');
        }

        // Check for circular reference in hierarchy
        const isCircular = await checkCircularReference(supabase, params.id, parent_id);
        if (isCircular) {
          return badRequest('Cannot set parent: would create circular reference');
        }

        // Parent must be in same organization or global
        if (parentCategory.organization_id !== existingCategory.organization_id) {
          if (parentCategory.organization_id !== null && existingCategory.organization_id !== null) {
            return badRequest('Parent category must be in the same organization');
          }
        }
      }
    }

    // Check for duplicate slug if slug is being changed
    if (slug && slug !== existingCategory.slug) {
      let duplicateCheck = supabase
        .from('knowledge_base_categories')
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
        return badRequest('A category with this slug already exists');
      }
    }

    // Update category
    const { data: updatedCategory, error: updateError } = await supabase
      .from('knowledge_base_categories')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('[KB Categories API] Error updating category:', updateError);
      return internalError('Failed to update category', { error: updateError.message });
    }

    return NextResponse.json(updatedCategory);
  } catch (error) {
    logger.error('[KB Categories API] Exception in PUT:', error);
    return internalError('Failed to update category');
  }
}

/**
 * DELETE /api/kb/categories/[id]
 * Delete a category
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to delete categories');
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
        return forbidden('You do not have permission to delete categories');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can delete categories');
    }

    // Get existing category
    const { data: existingCategory, error: fetchError } = await supabase
      .from('knowledge_base_categories')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingCategory) {
      return notFound('Category not found');
    }

    // Check organization access
    if (existingCategory.organization_id !== organizationId) {
      if (existingCategory.organization_id !== null || !userData.is_super_admin) {
        return forbidden('You do not have permission to delete this category');
      }
    }

    // Check if category has articles
    const { data: articles, error: articlesError } = await supabase
      .from('knowledge_base_articles')
      .select('id')
      .eq('category_id', params.id)
      .limit(1);

    if (articlesError) {
      logger.error('[KB Categories API] Error checking articles:', articlesError);
      return internalError('Failed to check category usage');
    }

    if (articles && articles.length > 0) {
      return badRequest('Cannot delete category: it contains articles. Please move or delete articles first.');
    }

    // Check if category has children
    const { data: children, error: childrenError } = await supabase
      .from('knowledge_base_categories')
      .select('id')
      .eq('parent_id', params.id)
      .limit(1);

    if (childrenError) {
      logger.error('[KB Categories API] Error checking children:', childrenError);
      return internalError('Failed to check category children');
    }

    if (children && children.length > 0) {
      return badRequest('Cannot delete category: it has subcategories. Please delete or move subcategories first.');
    }

    // Delete category
    const { error: deleteError } = await supabase
      .from('knowledge_base_categories')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('[KB Categories API] Error deleting category:', deleteError);
      return internalError('Failed to delete category', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[KB Categories API] Exception in DELETE:', error);
    return internalError('Failed to delete category');
  }
}

/**
 * Check for circular reference in category hierarchy
 */
async function checkCircularReference(
  supabase: any,
  categoryId: string,
  newParentId: string
): Promise<boolean> {
  try {
    let currentParentId = newParentId;
    const visited = new Set<string>([categoryId]);

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        return true; // Circular reference detected
      }

      visited.add(currentParentId);

      const { data: parent } = await supabase
        .from('knowledge_base_categories')
        .select('parent_id')
        .eq('id', currentParentId)
        .single();

      if (!parent || !parent.parent_id) {
        break;
      }

      currentParentId = parent.parent_id;
    }

    return false;
  } catch (error) {
    logger.error('[KB Categories API] Error checking circular reference:', error);
    return false;
  }
}

