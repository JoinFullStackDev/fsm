import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { CompanyContactWithCompany } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view contacts');
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

    // Build query
    let query = supabase
      .from('company_contacts')
      .select(`
        *,
        company:companies(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
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

