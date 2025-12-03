import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { TemplatePhase } from '@/types/project';

/**
 * Check if template is global (is_publicly_available = true)
 * Returns true if global, false otherwise
 */
async function isGlobalTemplate(templateId: string): Promise<boolean> {
  const adminClient = createAdminSupabaseClient();
  const { data: template } = await adminClient
    .from('project_templates')
    .select('is_publicly_available')
    .eq('id', templateId)
    .single();
  
  return template?.is_publicly_available === true;
}

// GET - List all phases for a template (ordered by display_order)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view template phases');
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

    // Allow admins and PMs to manage template phases
    if (currentUser.role !== 'admin' && currentUser.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Fetch all active phases for the template
    const { data: phases, error: phasesError } = await supabase
      .from('template_phases')
      .select('*')
      .eq('template_id', params.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      logger.error('Error loading template phases:', phasesError);
      return internalError('Failed to load template phases', { error: phasesError.message });
    }

    return NextResponse.json({ phases: phases || [] });
  } catch (error) {
    logger.error('Error in GET /api/templates/[id]/phases:', error);
    return internalError('Failed to load template phases', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create a new phase
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create template phases');
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

    // Allow admins and PMs to manage template phases
    if (currentUser.role !== 'admin' && currentUser.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Prevent editing global templates
    if (await isGlobalTemplate(params.id)) {
      return forbidden('Cannot edit global templates. Please duplicate the template to create your own copy.');
    }

    const body = await request.json();
    const { phase_name, data, display_order } = body;

    if (!phase_name || typeof phase_name !== 'string' || phase_name.trim().length === 0) {
      return badRequest('phase_name is required');
    }

    // Get the highest phase_number and display_order for this template
    const { data: existingPhases, error: existingError } = await supabase
      .from('template_phases')
      .select('phase_number, display_order')
      .eq('template_id', params.id)
      .order('phase_number', { ascending: false })
      .limit(1);

    if (existingError) {
      logger.error('Error checking existing phases:', existingError);
      return internalError('Failed to check existing phases', { error: existingError.message });
    }

    // Calculate next phase_number and display_order
    const nextPhaseNumber = existingPhases && existingPhases.length > 0
      ? existingPhases[0].phase_number + 1
      : 1;
    
    const nextDisplayOrder = display_order !== undefined
      ? display_order
      : (existingPhases && existingPhases.length > 0
          ? existingPhases[0].display_order + 1
          : 1);

    // Create the new phase
    const { data: newPhase, error: createError } = await supabase
      .from('template_phases')
      .insert({
        template_id: params.id,
        phase_number: nextPhaseNumber,
        phase_name,
        display_order: nextDisplayOrder,
        data: data || {},
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating template phase:', createError);
      return internalError('Failed to create template phase', { error: createError.message });
    }

    return NextResponse.json(newPhase, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/templates/[id]/phases:', error);
    return internalError('Failed to create template phase', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// PATCH - Update phase metadata (name, order, data)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update template phases');
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

    // Allow admins and PMs to manage template phases
    if (currentUser.role !== 'admin' && currentUser.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Prevent editing global templates
    if (await isGlobalTemplate(params.id)) {
      return forbidden('Cannot edit global templates. Please duplicate the template to create your own copy.');
    }

    const body = await request.json();
    const { phase_id, phase_name, display_order, data, is_active } = body;

    if (!phase_id) {
      return badRequest('phase_id is required');
    }

    // Build update object
    const updateData: Partial<TemplatePhase> = {};
    if (phase_name !== undefined) updateData.phase_name = phase_name;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (data !== undefined) updateData.data = data;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return badRequest('No fields to update');
    }

    // Update the phase
    const { data: updatedPhase, error: updateError } = await supabase
      .from('template_phases')
      .update(updateData)
      .eq('id', phase_id)
      .eq('template_id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating template phase:', updateError);
      return internalError('Failed to update template phase', { error: updateError.message });
    }

    if (!updatedPhase) {
      return notFound('Template phase');
    }

    return NextResponse.json(updatedPhase);
  } catch (error) {
    logger.error('Error in PATCH /api/templates/[id]/phases:', error);
    return internalError('Failed to update template phase', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// DELETE - Soft delete a phase (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete template phases');
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

    // Allow admins and PMs to manage template phases
    if (currentUser.role !== 'admin' && currentUser.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Prevent editing global templates
    if (await isGlobalTemplate(params.id)) {
      return forbidden('Cannot edit global templates. Please duplicate the template to create your own copy.');
    }

    const { searchParams } = new URL(request.url);
    const phaseId = searchParams.get('phase_id');

    if (!phaseId) {
      return badRequest('phase_id query parameter is required');
    }

    // Get phase_number first
    const { data: phase, error: phaseError } = await supabase
      .from('template_phases')
      .select('phase_number')
      .eq('id', phaseId)
      .eq('template_id', params.id)
      .single();

    if (phaseError || !phase) {
      return notFound('Template phase');
    }

    // Check if phase has associated field configs
    const { data: fieldConfigs, error: configsError } = await supabase
      .from('template_field_configs')
      .select('id')
      .eq('template_id', params.id)
      .eq('phase_number', phase.phase_number)
      .limit(1);

    // Soft delete by setting is_active = false
    const { data: deletedPhase, error: deleteError } = await supabase
      .from('template_phases')
      .update({ is_active: false })
      .eq('id', phaseId)
      .eq('template_id', params.id)
      .select()
      .single();

    if (deleteError) {
      logger.error('Error deleting template phase:', deleteError);
      return internalError('Failed to delete template phase', { error: deleteError.message });
    }

    if (!deletedPhase) {
      return notFound('Template phase');
    }

    return NextResponse.json({ 
      message: 'Phase soft deleted successfully',
      phase: deletedPhase 
    });
  } catch (error) {
    logger.error('Error in DELETE /api/templates/[id]/phases:', error);
    return internalError('Failed to delete template phase', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

