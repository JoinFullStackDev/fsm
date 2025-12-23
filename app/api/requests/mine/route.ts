import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/requests/mine
 * Get the current user's feature requests and bug reports
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view your requests');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    // Build query for user's own requests
    let query = supabase
      .from('feature_bug_requests')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (type === 'feature' || type === 'bug') {
      query = query.eq('type', type);
    }
    if (status === 'open' || status === 'in_progress' || status === 'resolved' || status === 'closed') {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      logger.error('[Requests API] Error fetching user requests:', error);
      return internalError('Failed to fetch requests', { error: error.message });
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    logger.error('[Requests API] Error in GET /api/requests/mine:', error);
    return internalError('Failed to fetch requests', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

