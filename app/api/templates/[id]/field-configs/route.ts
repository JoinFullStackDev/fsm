import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/[id]/field-configs
 * 
 * Gets field configs for a template.
 * Uses admin client to bypass RLS and avoid recursion.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view template field configs');
    }

    // Use admin client immediately to avoid any RLS recursion
    const adminClient = createAdminSupabaseClient();
    
    // Get user record using admin client (bypasses RLS)
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return notFound('User not found');
    }

    // Get organization ID from user record (already fetched with admin client)
    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Verify template exists using admin client (bypasses RLS completely)
    // Don't check access here - admin client bypasses RLS, so we'll check in application code
    const { data: template, error: templateError } = await adminClient
      .from('project_templates')
      .select('id, organization_id, is_publicly_available, created_by')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
    }

    // Check access in application code (not RLS) - super admins can see all, others can see templates from their org or globally available
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    if (!isSuperAdmin) {
      const hasAccess = 
        template.organization_id === organizationId || 
        template.is_publicly_available === true;
      
      if (!hasAccess) {
        return forbidden('You do not have access to view this template');
      }
    }

    // Fetch field configs using admin client (bypasses RLS completely)
    // Support optional phase_number filter via query parameter
    const { searchParams } = new URL(request.url);
    const phaseNumberParam = searchParams.get('phase_number');
    
    let query = adminClient
      .from('template_field_configs')
      .select('id, field_key, phase_number')
      .eq('template_id', params.id);
    
    if (phaseNumberParam) {
      const phaseNumber = parseInt(phaseNumberParam, 10);
      if (!isNaN(phaseNumber)) {
        query = query.eq('phase_number', phaseNumber);
      }
    }
    
    const { data: fieldConfigs, error: configsError } = await query
      .order('phase_number', { ascending: true })
      .order('display_order', { ascending: true });

    if (configsError) {
      logger.error('[Template Field Configs GET] Error loading field configs:', configsError);
      return internalError('Failed to load field configs', { error: configsError.message });
    }

    return NextResponse.json({ 
      fieldConfigs: fieldConfigs || [] 
    });
  } catch (error) {
    logger.error('Error in GET /api/templates/[id]/field-configs:', error);
    return internalError('Failed to load field configs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/templates/[id]/field-configs
 * 
 * Saves field configs for a template (handles INSERT, UPDATE, DELETE).
 * Uses admin client to bypass RLS and avoid recursion.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to save template field configs');
    }

    // Use admin client immediately to avoid any RLS recursion
    const adminClient = createAdminSupabaseClient();
    
    // Get user record using admin client (bypasses RLS)
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return notFound('User not found');
    }

    // Get organization ID from user record
    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Verify template exists and user has access
    const { data: template, error: templateError } = await adminClient
      .from('project_templates')
      .select('id, organization_id, is_publicly_available, created_by')
      .eq('id', params.id)
      .single();

    if (templateError || !template) {
      return notFound('Template not found');
    }

    // Check access
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      if (template.organization_id !== organizationId) {
        return forbidden('You do not have access to edit this template');
      }
    }

    const body = await request.json();
    const { fieldsToInsert, fieldsToUpdate, fieldsToDelete } = body;

    // Delete fields first
    if (fieldsToDelete && fieldsToDelete.length > 0) {
      const { error: deleteError } = await adminClient
        .from('template_field_configs')
        .delete()
        .in('id', fieldsToDelete);

      if (deleteError) {
        logger.error('[Template Field Configs PUT] Error deleting fields:', deleteError);
        return internalError('Failed to delete fields', { error: deleteError.message });
      }
    }

    // Update existing fields
    if (fieldsToUpdate && fieldsToUpdate.length > 0) {
      for (const field of fieldsToUpdate) {
        const { id, ...updateData } = field;
        const { error: updateError } = await adminClient
          .from('template_field_configs')
          .update(updateData)
          .eq('id', id);

        if (updateError) {
          logger.error('[Template Field Configs PUT] Error updating field:', updateError);
          return internalError(`Failed to update field ${field.field_key}`, { error: updateError.message });
        }
      }
    }

    // Insert new fields
    if (fieldsToInsert && fieldsToInsert.length > 0) {
      const { error: insertError } = await adminClient
        .from('template_field_configs')
        .insert(fieldsToInsert);

      if (insertError) {
        logger.error('[Template Field Configs PUT] Error inserting fields:', insertError);
        return internalError('Failed to insert fields', { error: insertError.message });
      }
    }

    return NextResponse.json({ 
      message: 'Field configs saved successfully' 
    });
  } catch (error) {
    logger.error('Error in PUT /api/templates/[id]/field-configs:', error);
    return internalError('Failed to save field configs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
