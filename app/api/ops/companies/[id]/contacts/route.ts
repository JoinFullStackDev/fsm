import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { createLeadFromContact } from '@/lib/ops/leads';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';
import type { CompanyContact } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view contacts');
    }

    const { id: companyId } = params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Build query
    let query = supabase
      .from('company_contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: contacts, error: contactsError } = await query;

    if (contactsError) {
      logger.error('Error loading contacts:', contactsError);
      return internalError('Failed to load contacts', { error: contactsError.message });
    }

    return NextResponse.json(contacts || []);
  } catch (error) {
    logger.error('Error in GET /api/ops/companies/[id]/contacts:', error);
    return internalError('Failed to load contacts', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create contacts');
    }

    const { id: companyId } = params;
    const body = await request.json();
    const {
      first_name, last_name, email, phone, notes, status,
      // Contact Information
      job_title, phone_mobile, website, linkedin_url,
      address_street, address_city, address_state, address_zip, address_country,
      // Lead Source & Marketing
      lead_source, campaign_initiative, date_first_contacted, original_inquiry_notes,
      // Status & Pipeline
      lead_status, pipeline_stage, priority_level, assigned_to, lifecycle_stage,
      // Activity Tracking
      last_contact_date, next_follow_up_date, follow_up_type, preferred_communication,
      // Preferences & Details
      is_decision_maker, budget, timeline_urgency, pain_points_needs, risk_flags,
      // Customer-Specific Data
      customer_since_date, contract_start_date, contract_end_date, renewal_date,
      subscription_level, support_rep_csm, health_score, nps_score, satisfaction_metrics,
      // System Fields
      email_opens, email_clicks, form_submission_data
    } = body;

    // Validate
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      return badRequest('First name is required');
    }
    if (!last_name || typeof last_name !== 'string' || last_name.trim().length === 0) {
      return badRequest('Last name is required');
    }

    // Get user record for created_by
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Create contact with all fields
    const { data: contact, error: contactError } = await supabase
      .from('company_contacts')
      .insert({
        company_id: companyId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        notes: notes || null,
        status: status || 'active',
        // Contact Information
        job_title: job_title?.trim() || null,
        phone_mobile: phone_mobile?.trim() || null,
        website: website?.trim() || null,
        linkedin_url: linkedin_url?.trim() || null,
        address_street: address_street?.trim() || null,
        address_city: address_city?.trim() || null,
        address_state: address_state?.trim() || null,
        address_zip: address_zip?.trim() || null,
        address_country: address_country?.trim() || null,
        // Lead Source & Marketing
        lead_source: lead_source || null,
        campaign_initiative: campaign_initiative?.trim() || null,
        date_first_contacted: date_first_contacted || null,
        original_inquiry_notes: original_inquiry_notes || null,
        // Status & Pipeline
        lead_status: lead_status || null,
        pipeline_stage: pipeline_stage || null,
        priority_level: priority_level || null,
        assigned_to: assigned_to || null,
        lifecycle_stage: lifecycle_stage || null,
        // Activity Tracking
        last_contact_date: last_contact_date || null,
        next_follow_up_date: next_follow_up_date || null,
        follow_up_type: follow_up_type || null,
        preferred_communication: preferred_communication || null,
        // Preferences & Details
        is_decision_maker: is_decision_maker ?? null,
        budget: budget?.trim() || null,
        timeline_urgency: timeline_urgency?.trim() || null,
        pain_points_needs: pain_points_needs || null,
        risk_flags: risk_flags || null,
        // Customer-Specific Data
        customer_since_date: customer_since_date || null,
        contract_start_date: contract_start_date || null,
        contract_end_date: contract_end_date || null,
        renewal_date: renewal_date || null,
        subscription_level: subscription_level?.trim() || null,
        support_rep_csm: support_rep_csm || null,
        health_score: health_score ?? null,
        nps_score: nps_score ?? null,
        satisfaction_metrics: satisfaction_metrics || null,
        // System Fields
        created_by: userData.id,
        email_opens: email_opens ?? 0,
        email_clicks: email_clicks ?? 0,
        form_submission_data: form_submission_data || null,
      })
      .select()
      .single();

    if (contactError) {
      logger.error('Error creating contact:', contactError);
      return internalError('Failed to create contact', { error: contactError.message });
    }

    // Auto-create lead
    try {
      await createLeadFromContact(supabase, contact.id, companyId);
    } catch (leadError) {
      logger.error('Error creating lead for contact:', leadError);
      // Don't fail the request if lead creation fails
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: companyId,
        related_entity_id: contact.id,
        related_entity_type: 'contact',
        event_type: 'contact_created',
        message: `Contact ${contact.first_name} ${contact.last_name} was added`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
      // Don't fail the request if activity feed creation fails
    }

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/companies/[id]/contacts:', error);
    return internalError('Failed to create contact', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

