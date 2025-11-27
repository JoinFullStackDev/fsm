import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/organizations/[id]
 * Get full organization details (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get organization with subscription and package
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select(`
        *,
        subscriptions!left(
          id,
          package_id,
          status,
          current_period_start,
          current_period_end,
          stripe_subscription_id,
          stripe_price_id,
          packages!inner(
            id,
            name,
            price_per_user_monthly,
            features
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (orgError || !organization) {
      return notFound('Organization not found');
    }

    // Get usage counts
    const [usersResult, projectsResult, templatesResult] = await Promise.all([
      adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.id),
      adminClient
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.id),
      adminClient
        .from('templates')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.id),
    ]);

    const subscription = organization.subscriptions && organization.subscriptions.length > 0 
      ? organization.subscriptions[0] 
      : null;
    const packageData = subscription?.packages || null;

    return NextResponse.json({
      organization: {
        ...organization,
        subscription: subscription
          ? {
              id: subscription.id,
              package_id: subscription.package_id,
              status: subscription.status,
              current_period_start: subscription.current_period_start,
              current_period_end: subscription.current_period_end,
              stripe_subscription_id: subscription.stripe_subscription_id,
              stripe_price_id: subscription.stripe_price_id,
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
        template_count: templatesResult.count || 0,
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/organizations/[id]:', error);
    return internalError('Failed to load organization details', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

