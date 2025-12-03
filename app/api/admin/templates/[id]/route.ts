import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/templates/[id]
 * 
 * Gets a single template with all its related data (phases, field configs, field groups).
 * Requires authentication and organization access.
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing template ID
 * @returns Template data or error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view templates');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record - use admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      logger.error('[Template GET] User not found:', userError);
      return notFound('User not found');
    }

    // Fetch template using admin client to bypass RLS
    const { data: template, error: templateError } = await adminClient
      .from('project_templates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
    }

    // Check access: super admins can see all, others can see templates from their org or globally available
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      const hasAccess = 
        template.organization_id === organizationId || 
        template.is_publicly_available === true;
      
      if (!hasAccess) {
        return forbidden('You do not have access to view this template');
      }
    }

    // Fetch related data
    const [phasesResult, configsResult, groupsResult] = await Promise.all([
      adminClient
        .from('template_phases')
        .select('*')
        .eq('template_id', params.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      adminClient
        .from('template_field_configs')
        .select('*')
        .eq('template_id', params.id)
        .order('phase_number', { ascending: true })
        .order('display_order', { ascending: true }),
      adminClient
        .from('template_field_groups')
        .select('*')
        .eq('template_id', params.id)
        .order('phase_number', { ascending: true })
        .order('display_order', { ascending: true }),
    ]);

    return NextResponse.json({
      template,
      phases: phasesResult.data || [],
      fieldConfigs: configsResult.data || [],
      fieldGroups: groupsResult.data || [],
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/templates/[id]:', error);
    return internalError('Failed to load template', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/admin/templates/[id]
 * 
 * Updates a template's metadata (name, description, category, is_public).
 * Cannot update global templates (is_publicly_available = true).
 * Requires admin authentication.
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing template ID
 * @returns Updated template or error response
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to update templates');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record - use admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      logger.error('[Template PUT] User not found:', userError);
      return notFound('User not found');
    }

    // Allow admins and PMs to update templates
    if (userData.role !== 'admin' && userData.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Fetch template to check if it's global
    const { data: template, error: templateError } = await adminClient
      .from('project_templates')
      .select('id, organization_id, is_publicly_available, created_by')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
    }

    // Prevent editing global templates (is_publicly_available = true)
    // Users must clone/duplicate them instead
    if (template.is_publicly_available === true) {
      return forbidden('Cannot edit global templates. Please duplicate the template to create your own copy.');
    }

    // Validate organization access (super admins can edit all non-global templates)
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      if (template.organization_id !== organizationId) {
        return forbidden('You do not have access to edit this template');
      }
    }

    // PMs can only edit templates they created (within their organization)
    if (userData.role === 'pm' && template.created_by !== userData.id) {
      return forbidden('You can only edit templates you created');
    }

    const body = await request.json();
    const { name, description, category, is_public } = body;

    // Build update object (don't allow changing is_publicly_available via this endpoint)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (is_public !== undefined) updateData.is_public = is_public;

    // Update template using admin client
    const { data: updatedTemplate, error: updateError } = await adminClient
      .from('project_templates')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('[Template PUT] Error updating template:', updateError);
      return internalError('Failed to update template', { error: updateError.message });
    }

    return NextResponse.json({ template: updatedTemplate });
  } catch (error) {
    logger.error('Error in PUT /api/admin/templates/[id]:', error);
    return internalError('Failed to update template', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/admin/templates/[id]
 * 
 * Deletes a template and all its related data (phases, field configs, field groups).
 * Requires admin authentication.
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing template ID
 * @returns Success message or error response
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete templates');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get current user and verify admin role
    let currentUser;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', session.user.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User not found');
      }

      currentUser = adminUserData;
    } else {
      currentUser = regularUserData;
    }

    // Allow admins and PMs to delete templates
    if (currentUser.role !== 'admin' && currentUser.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Verify template exists and get created_by, organization_id, and is_publicly_available
    const adminClient = createAdminSupabaseClient();
    const { data: template, error: templateError } = await adminClient
      .from('project_templates')
      .select('id, created_by, organization_id, is_publicly_available')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
    }

    // Prevent deleting global templates (is_publicly_available = true)
    // Users must clone/duplicate them instead
    if (template.is_publicly_available === true) {
      return forbidden('Cannot delete global templates. Please duplicate the template to create your own copy.');
    }

    // Validate organization access (super admins can delete all non-global templates)
    if (currentUser.role !== 'admin' || currentUser.is_super_admin !== true) {
      if (template.organization_id !== organizationId) {
        return forbidden('You do not have access to delete this template');
      }
    }

    // PMs can only delete templates they created (within their organization)
    if (currentUser.role === 'pm' && template.created_by !== currentUser.id) {
      return forbidden('You can only delete templates you created');
    }

    // Delete related records in the correct order (to avoid FK constraint violations)
    // Even though we have CASCADE, it's safer to delete explicitly
    // Use admin client to bypass RLS (already created above)
    
    // 1. Delete template_field_configs
    const { error: configsError } = await adminClient
      .from('template_field_configs')
      .delete()
      .eq('template_id', params.id);

    if (configsError) {
      logger.error('Error deleting template field configs:', configsError);
      return internalError('Failed to delete template field configs', { 
        error: configsError.message 
      });
    }

    // 2. Delete template_field_groups
    const { error: groupsError } = await adminClient
      .from('template_field_groups')
      .delete()
      .eq('template_id', params.id);

    if (groupsError) {
      logger.error('Error deleting template field groups:', groupsError);
      return internalError('Failed to delete template field groups', { 
        error: groupsError.message 
      });
    }

    // 3. Delete template_phases
    const { error: phasesError } = await adminClient
      .from('template_phases')
      .delete()
      .eq('template_id', params.id);

    if (phasesError) {
      logger.error('Error deleting template phases:', phasesError);
      return internalError('Failed to delete template phases', { 
        error: phasesError.message 
      });
    }

    // 4. Finally, delete the template itself
    const { error: deleteError } = await adminClient
      .from('project_templates')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('Error deleting template:', deleteError);
      return internalError('Failed to delete template', { 
        error: deleteError.message 
      });
    }

    return NextResponse.json({ 
      message: 'Template deleted successfully' 
    });
  } catch (error) {
    logger.error('Error in DELETE /api/admin/templates/[id]:', error);
    return internalError('Failed to delete template', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

