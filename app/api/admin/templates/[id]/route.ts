import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

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

    // Get current user and verify admin role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .select('id')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
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

