import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createPortalSession } from '@/lib/stripe/subscriptions';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, validateOrganizationAccess } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/create-portal
 * Create a Stripe customer portal session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to access the billing portal');
    }

    const body = await request.json();
    const { return_url } = body;

    if (!return_url) {
      return badRequest('Missing required field: return_url');
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

    // Create portal session
    const portalUrl = await createPortalSession(organizationId, return_url);

    if (!portalUrl) {
      return internalError('Failed to create portal session. Make sure the organization has a Stripe customer.');
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    logger.error('Error in POST /api/stripe/create-portal:', error);
    return internalError('Failed to create portal session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

