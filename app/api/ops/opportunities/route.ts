import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, notFound, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';
import { convertOpportunityToProject } from '@/lib/ops/opportunityConversion';
import type { Opportunity, OpportunityWithCompany } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view opportunities');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check if organization has ops tool access
    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    // Get user record to check if super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        company:companies(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by organization (super admins can see all)
    if (userData?.role === 'admin' && userData?.is_super_admin === true) {
      // Super admin can see all opportunities
    } else {
      query = query.eq('organization_id', organizationId);
    }

    // Apply filters
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: opportunities, error: opportunitiesError, count } = await query;

    if (opportunitiesError) {
      logger.error('Error loading opportunities:', opportunitiesError);
      return internalError('Failed to load opportunities', { error: opportunitiesError.message });
    }

    // Transform to match OpportunityWithCompany type
    const opportunitiesWithCompany: OpportunityWithCompany[] = (opportunities || []).map((opp: any) => ({
      ...opp,
      company: opp.company || undefined,
    }));

    return NextResponse.json({
      data: opportunitiesWithCompany,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/opportunities:', error);
    return internalError('Failed to load opportunities', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create opportunities');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check if organization has ops tool access
    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    const body = await request.json();
    const { company_id, name, value, status, source } = body;

    // Validate
    if (!company_id || typeof company_id !== 'string') {
      return badRequest('Company ID is required');
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Opportunity name is required');
    }

    // Verify company exists and belongs to user's organization
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, organization_id')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return badRequest('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Verify company belongs to user's organization
    if (company.organization_id !== organizationId) {
      return forbidden('Company does not belong to your organization');
    }

    // Create opportunity with organization_id
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .insert({
        organization_id: organizationId,
        company_id,
        name: name.trim(),
        value: value ? parseFloat(value) : null,
        status: status || 'new',
        source: source || 'Manual',
      })
      .select()
      .single();

    if (opportunityError) {
      logger.error('Error creating opportunity:', opportunityError);
      return internalError('Failed to create opportunity', { error: opportunityError.message });
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id,
        related_entity_id: opportunity.id,
        related_entity_type: 'opportunity',
        event_type: 'opportunity_created',
        message: `Opportunity "${opportunity.name}" was created`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
      // Don't fail the request if activity feed creation fails
    }

    // If source is "Converted", automatically convert to project
    if (source === 'Converted') {
      try {
        // Get user record for project owner
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .single();

        if (userError || !userData) {
          logger.error('Error getting user for conversion:', userError);
          // Continue without conversion if user lookup fails
        } else {
          // Convert opportunity to project
          const project = await convertOpportunityToProject(
            supabase,
            opportunity,
            userData.id
          );

          // Update opportunity status to 'converted'
          await supabase
            .from('opportunities')
            .update({ status: 'converted' })
            .eq('id', opportunity.id);

          // Return both opportunity and project
          const updatedOpportunity = { ...opportunity, status: 'converted' };
          return NextResponse.json({
            ...updatedOpportunity,
            project,
            converted: true,
          }, { status: 201 });
        }
      } catch (conversionError) {
        logger.error('Error auto-converting opportunity:', conversionError);
        // Continue and return opportunity even if conversion fails
      }
    }

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/opportunities:', error);
    return internalError('Failed to create opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

