import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
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

    // Get contact with company info and relations
    const { data: contact, error: contactError } = await supabase
      .from('company_contacts')
      .select(`
        *,
        company:companies(id, name),
        assigned_user:users!company_contacts_assigned_to_fkey(id, name, email),
        support_user:users!company_contacts_support_rep_csm_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (contactError || !contact) {
      if (contactError?.code === 'PGRST116') {
        return notFound('Contact not found');
      }
      logger.error('Error loading contact:', contactError);
      return internalError('Failed to load contact', { error: contactError?.message });
    }

    // Validate organization access (super admins can see all contacts)
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      if (contact.organization_id !== organizationId) {
        return forbidden('You do not have access to this contact');
      }
    }

    return NextResponse.json(contact);
  } catch (error) {
    logger.error('Error in GET /api/ops/contacts/[id]:', error);
    return internalError('Failed to load contact', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to update contacts');
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
    if (first_name !== undefined && (typeof first_name !== 'string' || first_name.trim().length === 0)) {
      return badRequest('First name cannot be empty');
    }
    if (last_name !== undefined && (typeof last_name !== 'string' || last_name.trim().length === 0)) {
      return badRequest('Last name cannot be empty');
    }

    // Get user record for modified_by
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get existing contact to check company_id, organization_id, and track changes
    const { data: existingContact, error: existingError } = await supabase
      .from('company_contacts')
      .select('company_id, organization_id, first_name, last_name, lead_status, pipeline_stage, assigned_to, next_follow_up_date, lead_source, priority_level, lifecycle_stage, email, phone, job_title')
      .eq('id', id)
      .single();

    if (existingError || !existingContact) {
      if (existingError?.code === 'PGRST116') {
        return notFound('Contact not found');
      }
      logger.error('Error checking contact:', existingError);
      return internalError('Failed to check contact', { error: existingError?.message });
    }

    // Validate organization access (super admins can update all contacts)
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      if (existingContact.organization_id !== organizationId) {
        return forbidden('You do not have access to update this contact');
      }
    }

    // Build update object with all fields
    const updateData: any = {};
    if (first_name !== undefined) updateData.first_name = first_name.trim();
    if (last_name !== undefined) updateData.last_name = last_name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    // Contact Information
    if (job_title !== undefined) updateData.job_title = job_title?.trim() || null;
    if (phone_mobile !== undefined) updateData.phone_mobile = phone_mobile?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url?.trim() || null;
    if (address_street !== undefined) updateData.address_street = address_street?.trim() || null;
    if (address_city !== undefined) updateData.address_city = address_city?.trim() || null;
    if (address_state !== undefined) updateData.address_state = address_state?.trim() || null;
    if (address_zip !== undefined) updateData.address_zip = address_zip?.trim() || null;
    if (address_country !== undefined) updateData.address_country = address_country?.trim() || null;
    // Lead Source & Marketing
    if (lead_source !== undefined) updateData.lead_source = lead_source || null;
    if (campaign_initiative !== undefined) updateData.campaign_initiative = campaign_initiative?.trim() || null;
    if (date_first_contacted !== undefined) updateData.date_first_contacted = date_first_contacted || null;
    if (original_inquiry_notes !== undefined) updateData.original_inquiry_notes = original_inquiry_notes || null;
    // Status & Pipeline
    if (lead_status !== undefined) updateData.lead_status = lead_status || null;
    if (pipeline_stage !== undefined) updateData.pipeline_stage = pipeline_stage || null;
    if (priority_level !== undefined) updateData.priority_level = priority_level || null;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to || null;
    if (lifecycle_stage !== undefined) updateData.lifecycle_stage = lifecycle_stage || null;
    // Activity Tracking
    if (last_contact_date !== undefined) updateData.last_contact_date = last_contact_date || null;
    if (next_follow_up_date !== undefined) updateData.next_follow_up_date = next_follow_up_date || null;
    if (follow_up_type !== undefined) updateData.follow_up_type = follow_up_type || null;
    if (preferred_communication !== undefined) updateData.preferred_communication = preferred_communication || null;
    // Preferences & Details
    if (is_decision_maker !== undefined) updateData.is_decision_maker = is_decision_maker;
    if (budget !== undefined) updateData.budget = budget?.trim() || null;
    if (timeline_urgency !== undefined) updateData.timeline_urgency = timeline_urgency?.trim() || null;
    if (pain_points_needs !== undefined) updateData.pain_points_needs = pain_points_needs || null;
    if (risk_flags !== undefined) updateData.risk_flags = risk_flags || null;
    // Customer-Specific Data
    if (customer_since_date !== undefined) updateData.customer_since_date = customer_since_date || null;
    if (contract_start_date !== undefined) updateData.contract_start_date = contract_start_date || null;
    if (contract_end_date !== undefined) updateData.contract_end_date = contract_end_date || null;
    if (renewal_date !== undefined) updateData.renewal_date = renewal_date || null;
    if (subscription_level !== undefined) updateData.subscription_level = subscription_level?.trim() || null;
    if (support_rep_csm !== undefined) updateData.support_rep_csm = support_rep_csm || null;
    if (health_score !== undefined) updateData.health_score = health_score ?? null;
    if (nps_score !== undefined) updateData.nps_score = nps_score ?? null;
    if (satisfaction_metrics !== undefined) updateData.satisfaction_metrics = satisfaction_metrics || null;
    // System Fields
    updateData.modified_by = userData.id;
    if (email_opens !== undefined) updateData.email_opens = email_opens ?? 0;
    if (email_clicks !== undefined) updateData.email_clicks = email_clicks ?? 0;
    if (form_submission_data !== undefined) updateData.form_submission_data = form_submission_data || null;

    // Update contact
    const { data: contact, error: contactError } = await supabase
      .from('company_contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (contactError || !contact) {
      logger.error('Error updating contact:', contactError);
      return internalError('Failed to update contact', { error: contactError?.message });
    }

    // Create activity feed items for specific changes (skip generic updates)
    try {
      const changes: string[] = [];
      
      // Track lead status changes
      if (lead_status !== undefined && lead_status !== existingContact.lead_status) {
        changes.push(`Lead status changed from ${existingContact.lead_status || 'None'} to ${lead_status}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'lead_status_changed',
          message: `Contact ${contact.first_name} ${contact.last_name}: Lead status changed from ${existingContact.lead_status || 'None'} to ${lead_status}`,
        });
      }
      
      // Track pipeline stage changes
      if (pipeline_stage !== undefined && pipeline_stage !== existingContact.pipeline_stage) {
        changes.push(`Pipeline stage changed from ${existingContact.pipeline_stage || 'None'} to ${pipeline_stage}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'pipeline_stage_changed',
          message: `Contact ${contact.first_name} ${contact.last_name}: Pipeline stage changed from ${existingContact.pipeline_stage || 'None'} to ${pipeline_stage}`,
        });
      }
      
      // Track assignment changes
      if (assigned_to !== undefined && assigned_to !== existingContact.assigned_to) {
        // Get assigned user name if available
        let assignedUserName = 'Unassigned';
        if (assigned_to) {
          const { data: assignedUser } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', assigned_to)
            .single();
          assignedUserName = assignedUser?.name || assignedUser?.email || 'Unknown';
        }
        const oldAssignedName = existingContact.assigned_to ? 'Someone' : 'Unassigned';
        changes.push(`Assignment changed from ${oldAssignedName} to ${assignedUserName}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'assignment_changed',
          message: `Contact ${contact.first_name} ${contact.last_name} assigned to ${assignedUserName}`,
        });
      }
      
      // Track next follow-up date changes
      if (next_follow_up_date !== undefined && next_follow_up_date !== existingContact.next_follow_up_date) {
        const oldDate = existingContact.next_follow_up_date 
          ? new Date(existingContact.next_follow_up_date).toLocaleDateString()
          : 'None';
        const newDate = next_follow_up_date 
          ? new Date(next_follow_up_date).toLocaleDateString()
          : 'None';
        changes.push(`Next follow-up date changed from ${oldDate} to ${newDate}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Next follow-up date set to ${newDate}`,
        });
      }
      
      // Track lead source changes
      if (lead_source !== undefined && lead_source !== existingContact.lead_source) {
        changes.push(`Lead source changed from ${existingContact.lead_source || 'None'} to ${lead_source}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Lead source changed to ${lead_source}`,
        });
      }
      
      // Track priority level changes
      if (priority_level !== undefined && priority_level !== existingContact.priority_level) {
        changes.push(`Priority changed from ${existingContact.priority_level || 'None'} to ${priority_level}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Priority changed to ${priority_level}`,
        });
      }
      
      // Track lifecycle stage changes
      if (lifecycle_stage !== undefined && lifecycle_stage !== existingContact.lifecycle_stage) {
        changes.push(`Lifecycle stage changed from ${existingContact.lifecycle_stage || 'None'} to ${lifecycle_stage}`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Lifecycle stage changed to ${lifecycle_stage}`,
        });
      }
      
      // Track email changes
      if (email !== undefined && email !== existingContact.email) {
        changes.push(`Email changed`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Email updated${email ? ` to ${email}` : ' (removed)'}`,
        });
      }
      
      // Track phone changes
      if (phone !== undefined && phone !== existingContact.phone) {
        changes.push(`Phone changed`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Phone updated${phone ? ` to ${phone}` : ' (removed)'}`,
        });
      }
      
      // Track job title changes
      if (job_title !== undefined && job_title !== existingContact.job_title) {
        changes.push(`Job title changed`);
        await createActivityFeedItem(supabase, {
          company_id: existingContact.company_id,
          related_entity_id: id,
          related_entity_type: 'contact',
          event_type: 'contact_updated',
          message: `Contact ${contact.first_name} ${contact.last_name}: Job title ${job_title ? `updated to ${job_title}` : 'removed'}`,
        });
      }
      
      // Only create generic update if no specific changes were tracked AND there were actual changes
      // (We skip generic updates to avoid noise from the database trigger)
      // Note: The database trigger will still create a generic update, but we're being more specific here
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
      // Don't fail the request if activity feed creation fails
    }

    return NextResponse.json(contact);
  } catch (error) {
    logger.error('Error in PUT /api/ops/contacts/[id]:', error);
    return internalError('Failed to update contact', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to delete contacts');
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

    // Check if contact exists and validate organization access
    const { data: contact, error: checkError } = await supabase
      .from('company_contacts')
      .select('id, company_id, organization_id, first_name, last_name')
      .eq('id', id)
      .single();

    if (checkError || !contact) {
      if (checkError?.code === 'PGRST116') {
        return notFound('Contact not found');
      }
      logger.error('Error checking contact:', checkError);
      return internalError('Failed to check contact', { error: checkError?.message });
    }

    // Validate organization access (super admins can delete all contacts)
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      if (contact.organization_id !== organizationId) {
        return forbidden('You do not have access to delete this contact');
      }
    }

    // Delete contact (cascade will handle leads)
    const { error: deleteError } = await supabase
      .from('company_contacts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Error deleting contact:', deleteError);
      return internalError('Failed to delete contact', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/contacts/[id]:', error);
    return internalError('Failed to delete contact', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

