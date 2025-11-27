import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/organizations
 * Get all organizations (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get all organizations with subscription and package info
    const { data: organizations, error: orgError } = await adminClient
      .from('organizations')
      .select(`
        *,
        subscriptions!left(
          id,
          package_id,
          status,
          current_period_start,
          current_period_end,
          packages!inner(
            id,
            name,
            price_per_user_monthly,
            features
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (orgError) {
      logger.error('Error loading organizations:', orgError);
      return internalError('Failed to load organizations', { error: orgError.message });
    }

    // Get usage counts for each organization
    const organizationsWithDetails = await Promise.all(
      (organizations || []).map(async (org: any) => {
        const [usersResult, projectsResult] = await Promise.all([
          adminClient
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id),
          adminClient
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id),
        ]);

        const subscription = org.subscriptions && org.subscriptions.length > 0 ? org.subscriptions[0] : null;
        const packageData = subscription?.packages || null;

        return {
          ...org,
          subscription: subscription
            ? {
                id: subscription.id,
                package_id: subscription.package_id,
                status: subscription.status,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
              }
            : null,
          package: packageData
            ? {
                id: packageData.id,
                name: packageData.name,
                price_per_user_monthly: packageData.price_per_user_monthly,
                features: packageData.features,
              }
            : null,
          user_count: usersResult.count || 0,
          project_count: projectsResult.count || 0,
        };
      })
    );

    return NextResponse.json({ organizations: organizationsWithDetails });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/organizations:', error);
    return internalError('Failed to load organizations', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

