import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getAllLimits } from '@/lib/packageLimits';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/limits
 * Get organization usage limits
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const limits = await getAllLimits(supabase, organizationId);

    return NextResponse.json(limits);
  } catch (error) {
    logger.error('Error in GET /api/organization/limits:', error);
    return internalError('Failed to load limits', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

