import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import type { PartnerCommissionStatus } from '@/types/ops';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ops/partners/[id]/commissions
 * Returns all commissions for a specific partner
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: partnerId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view commissions');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    const adminClient = createAdminSupabaseClient();

    // Verify partner exists
    const { data: partner, error: partnerError } = await adminClient
      .from('companies')
      .select('id, name, is_partner')
      .eq('id', partnerId)
      .eq('organization_id', organizationId)
      .single();

    if (partnerError || !partner) {
      return notFound('Partner company');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = adminClient
      .from('partner_commissions')
      .select(`
        *,
        opportunity:opportunities (id, name, value, company:companies!opportunities_company_id_fkey (id, name)),
        invoice:invoices (id, invoice_number, total_amount),
        approved_user:users!partner_commissions_approved_by_fkey (id, name, email),
        paid_user:users!partner_commissions_paid_by_fkey (id, name, email)
      `)
      .eq('organization_id', organizationId)
      .eq('partner_company_id', partnerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: commissions, error: commissionsError } = await query;

    if (commissionsError) {
      logger.error('Error loading commissions:', commissionsError);
      return internalError('Failed to load commissions', { error: commissionsError.message });
    }

    return NextResponse.json({
      data: commissions || [],
      partner: { id: partner.id, name: partner.name },
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/partners/[id]/commissions:', error);
    return internalError('Failed to load commissions', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * POST /api/ops/partners/[id]/commissions
 * Create a new commission record for a partner
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: partnerId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to create commissions');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    const adminClient = createAdminSupabaseClient();

    // Verify partner exists and get commission rate
    const { data: partner, error: partnerError } = await adminClient
      .from('companies')
      .select('id, name, is_partner, partner_commission_rate')
      .eq('id', partnerId)
      .eq('organization_id', organizationId)
      .single();

    if (partnerError || !partner) {
      return notFound('Partner company');
    }

    if (!partner.is_partner) {
      return badRequest('Company is not marked as a partner');
    }

    const body = await request.json();
    const { opportunity_id, invoice_id, commission_rate, base_amount, notes } = body;

    // Validate required fields
    if (typeof base_amount !== 'number' || base_amount <= 0) {
      return badRequest('Base amount must be a positive number');
    }

    // Use provided commission rate or partner's default rate
    const effectiveRate = typeof commission_rate === 'number' 
      ? commission_rate 
      : (partner.partner_commission_rate || 0);

    if (effectiveRate <= 0) {
      return badRequest('Commission rate must be specified');
    }

    // Calculate commission amount
    const commissionAmount = (base_amount * effectiveRate) / 100;

    // Verify opportunity belongs to organization if provided
    if (opportunity_id) {
      const { data: opp, error: oppError } = await adminClient
        .from('opportunities')
        .select('id')
        .eq('id', opportunity_id)
        .eq('organization_id', organizationId)
        .single();

      if (oppError || !opp) {
        return badRequest('Invalid opportunity ID');
      }
    }

    // Verify invoice belongs to organization if provided
    if (invoice_id) {
      const { data: inv, error: invError } = await adminClient
        .from('invoices')
        .select('id')
        .eq('id', invoice_id)
        .eq('organization_id', organizationId)
        .single();

      if (invError || !inv) {
        return badRequest('Invalid invoice ID');
      }
    }

    // Create commission record
    const { data: commission, error: createError } = await adminClient
      .from('partner_commissions')
      .insert({
        organization_id: organizationId,
        partner_company_id: partnerId,
        opportunity_id: opportunity_id || null,
        invoice_id: invoice_id || null,
        commission_rate: effectiveRate,
        base_amount: base_amount,
        commission_amount: commissionAmount,
        status: 'pending',
        notes: notes || null,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating commission:', createError);
      return internalError('Failed to create commission', { error: createError.message });
    }

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/partners/[id]/commissions:', error);
    return internalError('Failed to create commission', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * PATCH /api/ops/partners/[id]/commissions
 * Update a commission record (approve, mark as paid, etc.)
 * Body should include commission_id and fields to update
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: partnerId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update commissions');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    // Get user record for tracking who made changes
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    const adminClient = createAdminSupabaseClient();

    const body = await request.json();
    const { commission_id, status, payment_reference, notes } = body;

    if (!commission_id) {
      return badRequest('Commission ID is required');
    }

    // Verify commission exists and belongs to this partner
    const { data: existing, error: existingError } = await adminClient
      .from('partner_commissions')
      .select('id, status')
      .eq('id', commission_id)
      .eq('partner_company_id', partnerId)
      .eq('organization_id', organizationId)
      .single();

    if (existingError || !existing) {
      return notFound('Commission');
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    if (status) {
      const validStatuses: PartnerCommissionStatus[] = ['pending', 'approved', 'paid', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return badRequest('Invalid status');
      }
      updates.status = status;

      // Track who approved/paid
      if (status === 'approved' && existing.status !== 'approved') {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = userData?.id || null;
      }
      if (status === 'paid' && existing.status !== 'paid') {
        updates.paid_at = new Date().toISOString();
        updates.paid_by = userData?.id || null;
      }
    }

    if (payment_reference !== undefined) {
      updates.payment_reference = payment_reference;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('No valid fields to update');
    }

    const { data: commission, error: updateError } = await adminClient
      .from('partner_commissions')
      .update(updates)
      .eq('id', commission_id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating commission:', updateError);
      return internalError('Failed to update commission', { error: updateError.message });
    }

    return NextResponse.json(commission);
  } catch (error) {
    logger.error('Error in PATCH /api/ops/partners/[id]/commissions:', error);
    return internalError('Failed to update commission', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

