import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/dashboard
 * Get dashboard statistics (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get counts
    const [orgsResult, usersResult, subsResult] = await Promise.all([
      adminClient.from('organizations').select('id', { count: 'exact', head: true }),
      adminClient.from('users').select('id', { count: 'exact', head: true }),
      adminClient
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
    ]);

    // Calculate total revenue (placeholder - would need Stripe integration)
    const totalRevenue = 0;

    // Get recent activity (placeholder)
    const recentActivity: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
    }> = [];

    return NextResponse.json({
      totalOrganizations: orgsResult.count || 0,
      totalUsers: usersResult.count || 0,
      totalRevenue,
      activeSubscriptions: subsResult.count || 0,
      systemHealth: 'healthy' as const,
      recentActivity,
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/dashboard:', error);
    return internalError('Failed to load dashboard data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

