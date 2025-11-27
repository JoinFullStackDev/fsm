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

    // Update organization with Stripe customer ID
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        stripe_customer_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    if (updateError) {
      logger.error('Error updating organization with Stripe customer ID:', updateError);
      return internalError('Failed to update organization', { error: updateError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in POST /api/organization/update-stripe-customer:', error);
    return internalError('Failed to update organization', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

