import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId, getUsersByOrganization } from '@/lib/utils/userQueries';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// GET - List users in the same organization (for assignment dropdowns)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view users');
    }

    // Get user's organization_id (bypasses RLS)
    const organizationId = await getUserOrganizationId(authUser.id);
    
    if (!organizationId) {
      return NextResponse.json([]);
    }

    // Get users in the same organization (bypasses RLS but filters by org)
    const users = await getUsersByOrganization(organizationId);

    // Return only necessary fields
    const userList = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
      role: u.role,
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json(userList, { status: 200 });
  } catch (error) {
    logger.error('[Users] Unexpected error:', error);
    return internalError('Failed to fetch users', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

