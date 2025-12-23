import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError, badRequest, notFound, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import { sanitizeSearchInput } from '@/lib/utils/inputSanitization';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';
import { convertOpportunityToProject } from '@/lib/ops/opportunityConversion';
import type { Opportunity, OpportunityWithCompany } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view opportunities');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check if organization has ops tool access
    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Build query - always filter by organization
    // Even super admins should only see their organization's opportunities in the ops tool
    let query = adminClient
      .from('opportunities')
      .select(`
        *,
        company:companies!opportunities_company_id_fkey(id, name),
        referred_by_company:companies!opportunities_referred_by_company_id_fkey(id, name)
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = sanitizeSearchInput(search);
      if (sanitizedSearch) {
        query = query.ilike('name', `%${sanitizedSearch}%`);
      }
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
    const opportunitiesWithCompany: OpportunityWithCompany[] = (opportunities as Array<Opportunity & { company?: { id: string; name: string } | null; referred_by_company?: { id: string; name: string } | null }> || []).map((opp) => ({
      ...opp,
      company: opp.company || undefined,
      referred_by_company: opp.referred_by_company || undefined,
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to create opportunities');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check if organization has ops tool access
    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    const body = await request.json();
    const { company_id, name, value, status, source, referred_by_company_id } = body;

    // Validate
    if (!company_id || typeof company_id !== 'string') {
      return badRequest('Company ID is required');
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Opportunity name is required');
    }

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Verify company exists and belongs to user's organization
    const { data: company, error: companyError } = await adminClient
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

    // Validate referred_by_company_id if provided
    if (referred_by_company_id) {
      const { data: referrer, error: referrerError } = await adminClient
        .from('companies')
        .select('id, is_partner')
        .eq('id', referred_by_company_id)
        .eq('organization_id', organizationId)
        .single();

      if (referrerError || !referrer) {
        return badRequest('Invalid referring partner company');
      }
      if (!referrer.is_partner) {
        return badRequest('Referring company must be marked as a partner');
      }
    }

    // Create opportunity with organization_id using admin client
    const { data: opportunity, error: opportunityError } = await adminClient
      .from('opportunities')
      .insert({
        organization_id: organizationId,
        company_id,
        name: name.trim(),
        value: value ? parseFloat(value) : null,
        status: status || 'new',
        source: source || 'Manual',
        referred_by_company_id: referred_by_company_id || null,
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
        // Get user record for project owner using admin client
        const { data: userData, error: userError } = await adminClient
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();

        if (userError || !userData) {
          logger.error('Error getting user for conversion:', userError);
          // Continue without conversion if user lookup fails
        } else {
          // Convert opportunity to project using admin client
          const project = await convertOpportunityToProject(
            adminClient,
            opportunity,
            userData.id,
            organizationId
          );

          // Update opportunity status to 'converted' using admin client
          await adminClient
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

