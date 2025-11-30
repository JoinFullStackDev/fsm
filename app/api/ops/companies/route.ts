import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import { sendCompanyAddedEmail } from '@/lib/emailNotifications';
import type { Company, CompanyWithCounts } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view companies');
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
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query - always filter by organization
    // Even super admins should only see their organization's companies in the ops tool
    let query = supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: companies, error: companiesError, count } = await query;

    if (companiesError) {
      logger.error('Error loading companies:', companiesError);
      return internalError('Failed to load companies', { error: companiesError.message });
    }

    // Get counts for each company (scoped to organization)
    const companiesWithCounts: CompanyWithCounts[] = await Promise.all(
      (companies || []).map(async (company: Company) => {
        const [contactsResult, opportunitiesResult, projectsResult] = await Promise.all([
          supabase
            .from('company_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .eq('organization_id', organizationId),
          supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .eq('organization_id', organizationId),
          supabase
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .eq('organization_id', organizationId),
        ]);

        return {
          ...company,
          contacts_count: contactsResult.count || 0,
          opportunities_count: opportunitiesResult.count || 0,
          projects_count: projectsResult.count || 0,
        };
      })
    );

    return NextResponse.json({
      data: companiesWithCounts,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/companies:', error);
    return internalError('Failed to load companies', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create companies');
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

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    const body = await request.json();
    const {
      name, status, notes,
      company_size, industry, revenue_band, website,
      address_street, address_city, address_state, address_zip, address_country,
      account_notes
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Company name is required');
    }

    // Create company with all fields and organization_id
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        status: status || 'active',
        notes: notes || null,
        company_size: company_size || null,
        industry: industry?.trim() || null,
        revenue_band: revenue_band || null,
        website: website?.trim() || null,
        address_street: address_street?.trim() || null,
        address_city: address_city?.trim() || null,
        address_state: address_state?.trim() || null,
        address_zip: address_zip?.trim() || null,
        address_country: address_country?.trim() || null,
        account_notes: account_notes || null,
      })
      .select()
      .single();

    if (companyError) {
      logger.error('Error creating company:', companyError);
      return internalError('Failed to create company', { error: companyError.message });
    }

    // Send email notifications to organization admins
    const { data: orgAdmins } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('role', 'admin');

    if (orgAdmins) {
      const companyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/ops/companies/${company.id}`;
      for (const admin of orgAdmins) {
        if (admin.id !== userData.id) {
          sendCompanyAddedEmail(
            admin.id,
            company.name,
            companyLink
          ).catch((err) => {
            logger.error('[Company] Error sending email to admin:', err);
          });
        }
      }
    }

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/companies:', error);
    return internalError('Failed to create company', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

