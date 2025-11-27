import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getOrganizationContext } from '@/lib/organizationContext';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/context
 * Get current user's organization context
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view organization context');
    }

    const context = await getOrganizationContext(supabase, session.user.id);

    if (!context) {
      return internalError('Failed to load organization context');
    }

    return NextResponse.json(context);
  } catch (error) {
    logger.error('Error in GET /api/organization/context:', error);
    return internalError('Failed to load organization context', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

