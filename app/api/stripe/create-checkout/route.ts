import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createCheckoutSession } from '@/lib/stripe/subscriptions';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, validateOrganizationAccess } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/create-checkout
 * Create a Stripe checkout session for subscription
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create a checkout session');
    }

    const body = await request.json();
    const { package_id, success_url, cancel_url } = body;

    if (!package_id || !success_url || !cancel_url) {
      return badRequest('Missing required fields: package_id, success_url, cancel_url');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, session.user.id, organizationId);
    if (!hasAccess) {
      return forbidden('You do not have access to this organization');
    }

    // Create checkout session
    const checkoutUrl = await createCheckoutSession(organizationId, package_id, success_url, cancel_url);

    if (!checkoutUrl) {
      return internalError('Failed to create checkout session');
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    logger.error('Error in POST /api/stripe/create-checkout:', error);
    return internalError('Failed to create checkout session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

