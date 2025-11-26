import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// GET - List all users (for authenticated users - used for assignment dropdowns)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view users');
    }

    // Fetch all users (for assignment purposes)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role')
      .order('name', { ascending: true, nullsFirst: false });

    if (usersError) {
      logger.error('[Users] Error fetching users:', usersError);
      return internalError('Failed to fetch users', { error: usersError.message });
    }

    return NextResponse.json(users || [], { status: 200 });
  } catch (error) {
    logger.error('[Users] Unexpected error:', error);
    return internalError('Failed to fetch users', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

