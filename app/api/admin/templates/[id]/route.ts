import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

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

    // Verify template exists and get created_by and organization_id
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .select('id, created_by, organization_id')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
    }

    // Validate organization access (super admins can delete all templates)
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
    
    // 1. Delete template_field_configs
    const { error: configsError } = await supabase
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
    const { error: groupsError } = await supabase
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
    const { error: phasesError } = await supabase
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
    const { error: deleteError } = await supabase
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

