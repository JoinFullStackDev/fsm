import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// GET - Get a specific SOW for an opportunity
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view scope of work');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify opportunity access
    const { data: opportunity, error: opportunityError } = await adminClient
      .from('opportunities')
      .select(`
        id,
        company_id,
        company:companies!opportunities_company_id_fkey(
          id,
          organization_id
        )
      `)
      .eq('id', params.id)
      .single();

    if (opportunityError || !opportunity) {
      return notFound('Opportunity not found');
    }

    // Check access
    const company = opportunity.company as any;
    if (!company || company.organization_id !== organizationId) {
      const { data: userData } = await adminClient
        .from('users')
        .select('role, is_super_admin')
        .eq('auth_id', user.id)
        .single();
      
      if (!userData || !(userData.role === 'admin' && userData.is_super_admin === true)) {
        return forbidden('You do not have access to this opportunity');
      }
    }

    // Get SOW
    const { data: sow, error: sowError } = await adminClient
      .from('project_scope_of_work')
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .eq('id', params.sowId)
      .eq('opportunity_id', params.id)
      .single();

    if (sowError || !sow) {
      return notFound('Scope of work not found');
    }

    return NextResponse.json(sow);
  } catch (error) {
    logger.error('[Opportunity SOW GET] Unexpected error:', error);
    return internalError('Failed to load scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// PUT - Update a SOW for an opportunity
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to update scope of work');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify opportunity access
    const { data: opportunity, error: opportunityError } = await adminClient
      .from('opportunities')
      .select(`
        id,
        company_id,
        company:companies!opportunities_company_id_fkey(
          id,
          organization_id
        )
      `)
      .eq('id', params.id)
      .single();

    if (opportunityError || !opportunity) {
      return notFound('Opportunity not found');
    }

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Check access
    const company = opportunity.company as any;
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const hasAccess = company && company.organization_id === organizationId;
    
    if (!isSuperAdmin && !hasAccess) {
      return forbidden('You do not have access to update scope of work for this opportunity');
    }

    // Verify SOW exists
    const { data: existingSOW } = await adminClient
      .from('project_scope_of_work')
      .select('id, status')
      .eq('id', params.sowId)
      .eq('opportunity_id', params.id)
      .single();

    if (!existingSOW) {
      return notFound('Scope of work not found');
    }

    const body = await request.json();
    const {
      title,
      description,
      objectives,
      deliverables,
      timeline,
      budget,
      assumptions,
      constraints,
      exclusions,
      acceptance_criteria,
      status,
    } = body;

    // Build update object
    const updateData: {
      title?: string;
      description?: string;
      objectives?: string;
      deliverables?: string;
      timeline?: string;
      budget?: number;
      assumptions?: string;
      constraints?: string;
      exclusions?: string;
      acceptance_criteria?: string;
      status?: string;
      approved_by?: string;
      approved_at?: string;
    } = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (objectives !== undefined) updateData.objectives = objectives;
    if (deliverables !== undefined) updateData.deliverables = deliverables;
    if (timeline !== undefined) updateData.timeline = timeline;
    if (budget !== undefined) updateData.budget = budget;
    if (assumptions !== undefined) updateData.assumptions = assumptions;
    if (constraints !== undefined) updateData.constraints = constraints;
    if (exclusions !== undefined) updateData.exclusions = exclusions;
    if (acceptance_criteria !== undefined) updateData.acceptance_criteria = acceptance_criteria;
    if (status !== undefined) {
      updateData.status = status;
      // If approving, set approved_by and approved_at
      if (status === 'approved' && existingSOW.status !== 'approved') {
        updateData.approved_by = userData.id;
        updateData.approved_at = new Date().toISOString();
      }
    }

    const { data: updatedSOW, error: updateError } = await adminClient
      .from('project_scope_of_work')
      .update(updateData)
      .eq('id', params.sowId)
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .single();

    if (updateError) {
      logger.error('[Opportunity SOW PUT] Error updating SOW:', updateError);
      return internalError('Failed to update scope of work', { error: updateError.message });
    }

    return NextResponse.json(updatedSOW);
  } catch (error) {
    logger.error('[Opportunity SOW PUT] Unexpected error:', error);
    return internalError('Failed to update scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// DELETE - Delete a SOW for an opportunity
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sowId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to delete scope of work');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify opportunity access
    const { data: opportunity, error: opportunityError } = await adminClient
      .from('opportunities')
      .select(`
        id,
        company_id,
        company:companies!opportunities_company_id_fkey(
          id,
          organization_id
        )
      `)
      .eq('id', params.id)
      .single();

    if (opportunityError || !opportunity) {
      return notFound('Opportunity not found');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Check access
    const company = opportunity.company as any;
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const hasAccess = company && company.organization_id === organizationId;
    
    if (!isSuperAdmin && !hasAccess) {
      return forbidden('You do not have access to delete scope of work for this opportunity');
    }

    // Verify SOW exists
    const { data: existingSOW } = await adminClient
      .from('project_scope_of_work')
      .select('id')
      .eq('id', params.sowId)
      .eq('opportunity_id', params.id)
      .single();

    if (!existingSOW) {
      return notFound('Scope of work not found');
    }

    // Delete SOW (cascade will delete resource allocations)
    const { error: deleteError } = await adminClient
      .from('project_scope_of_work')
      .delete()
      .eq('id', params.sowId);

    if (deleteError) {
      logger.error('[Opportunity SOW DELETE] Error deleting SOW:', deleteError);
      return internalError('Failed to delete scope of work', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Opportunity SOW DELETE] Unexpected error:', error);
    return internalError('Failed to delete scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

