import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserByAuthId } from '@/lib/utils/userQueries';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/me
 * Get current user's profile (bypasses RLS)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view your profile');
    }

    // Get user record (bypasses RLS)
    const user = await getUserByAuthId(authUser.id);

    if (!user) {
      return unauthorized('User record not found');
    }

    return NextResponse.json(user);
  } catch (error) {
    logger.error('[Users API] Error in GET /me:', error);
    return internalError('Failed to fetch user profile');
  }
}

