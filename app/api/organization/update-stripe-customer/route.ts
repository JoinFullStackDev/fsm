import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organization/update-stripe-customer
 * Update organization with Stripe customer ID
 * Can be called during signup (no auth required) or by authenticated users
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization_id, stripe_customer_id } = body;

    if (!organization_id || !stripe_customer_id) {
      return badRequest('Missing required fields: organization_id, stripe_customer_id');
    }

    const adminClient = createAdminSupabaseClient();

    // Check current state for idempotency
    const { data: orgData, error: fetchError } = await adminClient
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', organization_id)
      .single();

    if (fetchError) {
      logger.error('[UpdateStripeCustomer] Error fetching organization:', fetchError);
      return internalError('Failed to fetch organization', { error: fetchError.message });
    }

    if (!orgData) {
      return badRequest('Organization not found');
    }

    // Idempotency: If customer ID is already set to the same value, return success
    if (orgData.stripe_customer_id === stripe_customer_id) {
      logger.info('[UpdateStripeCustomer] Customer ID already set to same value (idempotent):', {
        organizationId: organization_id,
        customerId: stripe_customer_id,
      });
      return NextResponse.json({ success: true, already_set: true });
    }

    // If customer ID is already set to a different value, log warning but update anyway
    // This can happen if webhook fires before callback, or if there's a race condition
    if (orgData.stripe_customer_id && orgData.stripe_customer_id !== stripe_customer_id) {
      logger.warn('[UpdateStripeCustomer] Customer ID already set to different value, updating:', {
        organizationId: organization_id,
        existingCustomerId: orgData.stripe_customer_id,
        newCustomerId: stripe_customer_id,
      });
    }

    // Update organization with Stripe customer ID
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        stripe_customer_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    if (updateError) {
      logger.error('[UpdateStripeCustomer] Error updating organization with Stripe customer ID:', {
        error: updateError.message,
        errorCode: updateError.code,
        organizationId: organization_id,
        customerId: stripe_customer_id,
      });
      return internalError('Failed to update organization', { error: updateError.message });
    }

    logger.info('[UpdateStripeCustomer] Successfully updated customer ID:', {
      organizationId: organization_id,
      customerId: stripe_customer_id,
      previousCustomerId: orgData.stripe_customer_id || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in POST /api/organization/update-stripe-customer:', error);
    return internalError('Failed to update organization', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

