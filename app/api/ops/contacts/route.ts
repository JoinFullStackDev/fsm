import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import { sanitizeSearchInput } from '@/lib/utils/inputSanitization';
import type { CompanyContactWithCompany } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view contacts');
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
    const leadStatus = searchParams.get('lead_status');
    const pipelineStage = searchParams.get('pipeline_stage');
    const leadSource = searchParams.get('lead_source');
    const assignedTo = searchParams.get('assigned_to');
    const lifecycleStage = searchParams.get('lifecycle_stage');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query - always filter by organization
    // Even super admins should only see their organization's contacts in the ops tool
    let query = supabase
      .from('company_contacts')
      .select(`
        *,
        company:companies(id, name)
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = sanitizeSearchInput(search);
      if (sanitizedSearch) {
        query = query.or(`first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
      }
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (leadStatus) {
      query = query.eq('lead_status', leadStatus);
    }
    if (pipelineStage) {
      query = query.eq('pipeline_stage', pipelineStage);
    }
    if (leadSource) {
      query = query.eq('lead_source', leadSource);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (lifecycleStage) {
      query = query.eq('lifecycle_stage', lifecycleStage);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: contacts, error: contactsError, count } = await query;

    if (contactsError) {
      logger.error('Error loading contacts:', contactsError);
      return internalError('Failed to load contacts', { error: contactsError.message });
    }

    // Transform to match CompanyContactWithCompany type
    const contactsWithCompany: CompanyContactWithCompany[] = (contacts || []).map((contact: any) => ({
      ...contact,
      company: contact.company || undefined,
    }));

    return NextResponse.json({
      data: contactsWithCompany,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/contacts:', error);
    return internalError('Failed to load contacts', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

