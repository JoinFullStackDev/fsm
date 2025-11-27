import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { Company, CompanyWithCounts } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view companies');
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('companies')
      .select('*', { count: 'exact' })
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

    // Get counts for each company
    const companiesWithCounts: CompanyWithCounts[] = await Promise.all(
      (companies || []).map(async (company: Company) => {
        const [contactsResult, opportunitiesResult, projectsResult] = await Promise.all([
          supabase
            .from('company_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),
          supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),
          supabase
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),
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

    // Create company with all fields
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
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

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/companies:', error);
    return internalError('Failed to create company', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

