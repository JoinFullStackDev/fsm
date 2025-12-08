import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Types for organization queries
interface OrganizationWithSubscription {
  id: string;
  name: string;
  created_at: string;
  subscriptions?: SubscriptionWithPackage[] | null;
}

interface SubscriptionWithPackage {
  id: string;
  package_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  packages?: PackageData | null;
}

interface PackageData {
  id: string;
  name: string;
  price_per_user_monthly: number | null;
  features: Record<string, boolean> | null;
}

interface UserCountRow {
  organization_id: string;
  count: number | string;
}

interface ProjectCountRow {
  organization_id: string;
  count: number | string;
}

interface UserOrgRow {
  organization_id: string | null;
}

interface ProjectOrgRow {
  organization_id: string | null;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/organizations
 * Get all organizations (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Check if user is super admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      return forbidden('Super admin access required');
    }

    const adminClient = createAdminSupabaseClient();

    // Add query timeout and limit to prevent database overload
    // Limit to 1000 organizations max (should be more than enough)
    const MAX_ORGANIZATIONS = 1000;
    const QUERY_TIMEOUT_MS = 5000; // 5 seconds max

    // Get all organizations with subscription and package info
    // Use Promise.race to implement timeout
    const queryPromise = adminClient
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
      .order('created_at', { ascending: false })
      .limit(MAX_ORGANIZATIONS);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS);
    });

    const { data: organizations, error: orgError } = await Promise.race([
      queryPromise,
      timeoutPromise,
    ]).catch(() => {
      return { data: null, error: { message: 'Query timeout - too many organizations' } };
    }) as { data: OrganizationWithSubscription[] | null; error: { message: string } | null };

    if (orgError) {
      logger.error('Error loading organizations:', orgError);
      if (orgError.message?.includes('timeout')) {
        return internalError('Query timeout - too many organizations to load. Please use pagination.', { error: orgError.message });
      }
      return internalError('Failed to load organizations', { error: orgError.message });
    }

    if (!organizations) {
      return internalError('Failed to load organizations - query returned no data');
    }

    // OPTIMIZED: Get all usage counts in 2 queries instead of N*2 queries
    // This prevents N+1 query problem and database overload
    const [userCountsResult, projectCountsResult] = await Promise.all([
      // Get user counts for all organizations in one query using RPC function
      (async () => {
        try {
          const result = await adminClient.rpc('get_organization_user_counts');
          return result;
        } catch (error) {
          logger.warn('[Admin Organizations] RPC function not available, using fallback:', error);
          // Fallback: Fetch all users and count in memory (less efficient but works)
          const result = await adminClient
            .from('users')
            .select('organization_id');
          const counts: Record<string, number> = {};
          (result.data as UserOrgRow[] | null)?.forEach((user) => {
            if (user.organization_id) {
              counts[user.organization_id] = (counts[user.organization_id] || 0) + 1;
            }
          });
          return { data: counts, error: null };
        }
      })(),
      // Get project counts for all organizations in one query using RPC function
      (async () => {
        try {
          const result = await adminClient.rpc('get_organization_project_counts');
          return result;
        } catch (error) {
          logger.warn('[Admin Organizations] RPC function not available, using fallback:', error);
          // Fallback: Fetch all projects and count in memory (less efficient but works)
          const result = await adminClient
            .from('projects')
            .select('organization_id');
          const counts: Record<string, number> = {};
          (result.data as ProjectOrgRow[] | null)?.forEach((project) => {
            if (project.organization_id) {
              counts[project.organization_id] = (counts[project.organization_id] || 0) + 1;
            }
          });
          return { data: counts, error: null };
        }
      })(),
    ]);

    // Parse counts from RPC results (RPC returns array of {organization_id, count})
    const userCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};

    if (userCountsResult.data && Array.isArray(userCountsResult.data)) {
      // RPC returned array of {organization_id, count}
      (userCountsResult.data as UserCountRow[]).forEach((item) => {
        userCounts[item.organization_id] = Number(item.count) || 0;
      });
    } else if (userCountsResult.data && typeof userCountsResult.data === 'object') {
      // Fallback returned object map
      Object.assign(userCounts, userCountsResult.data);
    }

    if (projectCountsResult.data && Array.isArray(projectCountsResult.data)) {
      // RPC returned array of {organization_id, count}
      (projectCountsResult.data as ProjectCountRow[]).forEach((item) => {
        projectCounts[item.organization_id] = Number(item.count) || 0;
      });
    } else if (projectCountsResult.data && typeof projectCountsResult.data === 'object') {
      // Fallback returned object map
      Object.assign(projectCounts, projectCountsResult.data);
    }

    // Map organizations with counts (no individual queries needed)
    const organizationsWithDetails = (organizations || []).map((org) => {
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
        user_count: userCounts[org.id] || 0,
        project_count: projectCounts[org.id] || 0,
      };
    });

    return NextResponse.json({ organizations: organizationsWithDetails });
  } catch (error) {
    logger.error('Error in GET /api/admin/organizations:', error);
    return internalError('Failed to load organizations', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

