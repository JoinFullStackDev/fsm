import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
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
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', session.user.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User not found');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
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

    // Validate organization access - always check organization
    if (company.organization_id !== organizationId) {
      return forbidden('You do not have access to this company');
    }

    // Get counts (scoped to organization)
    const [contactsResult, opportunitiesResult, projectsResult] = await Promise.all([
      supabase
        .from('company_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id)
        .eq('organization_id', organizationId),
      supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id)
        .eq('organization_id', organizationId),
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id)
        .eq('organization_id', organizationId),
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
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', session.user.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User not found');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const { id } = params;
    const body = await request.json();
    const {
      name, status, notes,
      company_size, industry, revenue_band, website,
      address_street, address_city, address_state, address_zip, address_country,
      account_notes
    } = body;

    // Get existing company to validate organization access
    const { data: existingCompany, error: existingError } = await supabase
      .from('companies')
      .select('organization_id')
      .eq('id', id)
      .single();

    if (existingError || !existingCompany) {
      if (existingError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', existingError);
      return internalError('Failed to check company', { error: existingError?.message });
    }

    // Validate organization access - always check organization
    if (existingCompany.organization_id !== organizationId) {
      return forbidden('You do not have access to update this company');
    }

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
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', session.user.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User not found');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const { id } = params;

    // Check if company exists and validate organization access
    const { data: company, error: checkError } = await supabase
      .from('companies')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (checkError || !company) {
      if (checkError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', checkError);
      return internalError('Failed to check company', { error: checkError?.message });
    }

    // Validate organization access - always check organization
    if (company.organization_id !== organizationId) {
      return forbidden('You do not have access to delete this company');
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

