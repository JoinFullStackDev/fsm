import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ScopeOfWork } from '@/types/project';

export const dynamic = 'force-dynamic';

// GET - Get all SOWs for an opportunity
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Check access - user must have access to the company's organization
    const company = opportunity.company as any;
    if (!company || company.organization_id !== organizationId) {
      // Check if user is super admin
      const { data: userData } = await adminClient
        .from('users')
        .select('role, is_super_admin')
        .eq('auth_id', user.id)
        .single();
      
      if (!userData || !(userData.role === 'admin' && userData.is_super_admin === true)) {
        return forbidden('You do not have access to this opportunity');
      }
    }

    // Get SOWs for this opportunity
    const { data: sows, error: sowsError } = await adminClient
      .from('project_scope_of_work')
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .eq('opportunity_id', params.id)
      .order('version', { ascending: false });

    if (sowsError) {
      logger.error('[Opportunity SOW GET] Error loading SOWs:', sowsError);
      return internalError('Failed to load scope of work', { error: sowsError.message });
    }

    return NextResponse.json({ sows: sows || [] });
  } catch (error) {
    logger.error('[Opportunity SOW GET] Unexpected error:', error);
    return internalError('Failed to load scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create a new SOW for an opportunity
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to create scope of work');
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

    // Check access - user must have access to the company's organization
    const company = opportunity.company as any;
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const hasAccess = company && company.organization_id === organizationId;
    
    if (!isSuperAdmin && !hasAccess) {
      return forbidden('You do not have access to create scope of work for this opportunity');
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
      resource_allocations,
    } = body;

    if (!title || !title.trim()) {
      return badRequest('Title is required');
    }

    // Get next version number for this opportunity
    const { data: latestSOW } = await adminClient
      .from('project_scope_of_work')
      .select('version')
      .eq('opportunity_id', params.id)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = latestSOW ? latestSOW.version + 1 : 1;

    // Create SOW with opportunity_id (project_id will be NULL)
    const { data: sow, error: sowError } = await adminClient
      .from('project_scope_of_work')
      .insert({
        project_id: null,
        opportunity_id: params.id,
        version: nextVersion,
        title: title.trim(),
        description: description || null,
        objectives: objectives || [],
        deliverables: deliverables || [],
        timeline: timeline || {},
        budget: budget || {},
        assumptions: assumptions || [],
        constraints: constraints || [],
        exclusions: exclusions || [],
        acceptance_criteria: acceptance_criteria || [],
        status: status || 'draft',
        created_by: userData.id,
      })
      .select()
      .single();

    if (sowError) {
      logger.error('[Opportunity SOW POST] Error creating SOW:', sowError);
      return internalError('Failed to create scope of work', { error: sowError.message });
    }

    // Note: Resource allocations for opportunity-based SOWs may need to be deferred
    // until the opportunity is converted to a project, as we need project_members
    // For now, we'll skip resource allocations for opportunity SOWs
    // They can be added after conversion

    // Fetch the complete SOW
    const { data: completeSOW } = await adminClient
      .from('project_scope_of_work')
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .eq('id', sow.id)
      .single();

    return NextResponse.json(completeSOW, { status: 201 });
  } catch (error) {
    logger.error('[Opportunity SOW POST] Unexpected error:', error);
    return internalError('Failed to create scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

