import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { Company, CompanyWithCounts } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view companies');
    }

    const { id } = params;

    // Get company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error loading company:', companyError);
      return internalError('Failed to load company', { error: companyError?.message });
    }

    // Get counts
    const [contactsResult, opportunitiesResult, projectsResult] = await Promise.all([
      supabase
        .from('company_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id),
      supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id),
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id),
    ]);

    const companyWithCounts: CompanyWithCounts = {
      ...company,
      contacts_count: contactsResult.count || 0,
      opportunities_count: opportunitiesResult.count || 0,
      projects_count: projectsResult.count || 0,
    };

    return NextResponse.json(companyWithCounts);
  } catch (error) {
    logger.error('Error in GET /api/ops/companies/[id]:', error);
    return internalError('Failed to load company', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update companies');
    }

    const { id } = params;
    const body = await request.json();
    const {
      name, status, notes,
      company_size, industry, revenue_band, website,
      address_street, address_city, address_state, address_zip, address_country,
      account_notes
    } = body;

    // Validate
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return badRequest('Company name cannot be empty');
    }

    // Build update object with all fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (company_size !== undefined) updateData.company_size = company_size || null;
    if (industry !== undefined) updateData.industry = industry?.trim() || null;
    if (revenue_band !== undefined) updateData.revenue_band = revenue_band || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (address_street !== undefined) updateData.address_street = address_street?.trim() || null;
    if (address_city !== undefined) updateData.address_city = address_city?.trim() || null;
    if (address_state !== undefined) updateData.address_state = address_state?.trim() || null;
    if (address_zip !== undefined) updateData.address_zip = address_zip?.trim() || null;
    if (address_country !== undefined) updateData.address_country = address_country?.trim() || null;
    if (account_notes !== undefined) updateData.account_notes = account_notes || null;

    // Update company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error updating company:', companyError);
      return internalError('Failed to update company', { error: companyError?.message });
    }

    return NextResponse.json(company);
  } catch (error) {
    logger.error('Error in PUT /api/ops/companies/[id]:', error);
    return internalError('Failed to update company', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete companies');
    }

    const { id } = params;

    // Check if company exists
    const { data: company, error: checkError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !company) {
      if (checkError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', checkError);
      return internalError('Failed to check company', { error: checkError?.message });
    }

    // Delete company (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Error deleting company:', deleteError);
      return internalError('Failed to delete company', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/companies/[id]:', error);
    return internalError('Failed to delete company', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

