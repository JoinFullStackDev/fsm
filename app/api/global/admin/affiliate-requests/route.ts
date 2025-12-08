import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import logger from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify super admin access
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    const adminSupabase = createAdminSupabaseClient();

    let query = adminSupabase
      .from('affiliate_applications')
      .select(`
        *,
        user:users!affiliate_applications_user_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: applications, error } = await query;

    if (error) {
      logger.error('[Admin Affiliate Requests] Failed to fetch applications:', { error });
      return NextResponse.json(
        { error: 'Failed to fetch applications' },
        { status: 500 }
      );
    }

    // Get counts by status
    const { data: counts, error: countError } = await adminSupabase
      .from('affiliate_applications')
      .select('status');

    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };

    if (counts) {
      counts.forEach((app: { status: string }) => {
        statusCounts.total++;
        if (app.status === 'pending') statusCounts.pending++;
        else if (app.status === 'approved') statusCounts.approved++;
        else if (app.status === 'rejected') statusCounts.rejected++;
      });
    }

    return NextResponse.json({
      applications,
      counts: statusCounts,
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Super admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error('[Admin Affiliate Requests] Unexpected error:', { error });
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

