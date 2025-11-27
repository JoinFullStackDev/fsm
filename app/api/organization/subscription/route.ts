import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { validateOrganizationAccess } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organization/subscription
 * Create a subscription for an organization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create a subscription');
    }

    const body = await request.json();
    const { organization_id, package_id } = body;

    if (!organization_id || !package_id) {
      return badRequest('Missing required fields: organization_id, package_id');
    }

    // Validate organization access (or allow during signup)
    const hasAccess = await validateOrganizationAccess(supabase, session.user.id, organization_id);
    if (!hasAccess) {
      // During signup, user might not be assigned yet, so check if they're creating their own org
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', session.user.id)
        .single();

      if (userData?.organization_id !== organization_id) {
        return forbidden('You do not have access to this organization');
      }
    }

    const adminClient = createAdminSupabaseClient();

    // Check if subscription already exists
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      return badRequest('Organization already has an active subscription');
    }

    // Create subscription
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .insert({
        organization_id,
        package_id,
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days trial
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (subError) {
      logger.error('Error creating subscription:', subError);
      return internalError('Failed to create subscription', { error: subError.message });
    }

    // Update organization subscription status
    await adminClient
      .from('organizations')
      .update({
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/organization/subscription:', error);
    return internalError('Failed to create subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

