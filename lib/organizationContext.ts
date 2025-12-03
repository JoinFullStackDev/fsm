/**
 * Organization context utilities
 * Provides functions to get user organization, validate access, and check package limits
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete'; // Note: organizations table uses 'trial', subscriptions table uses 'trialing'
  trial_ends_at: string | null;
  logo_url: string | null;
  icon_url: string | null;
  module_overrides: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

export interface PackageFeatures {
  max_projects: number | null;
  max_users: number | null;
  max_templates: number | null;
  ai_features_enabled: boolean;
  ai_task_generator_enabled: boolean;
  export_features_enabled: boolean;
  ops_tool_enabled: boolean;
  analytics_enabled: boolean;
  api_access_enabled: boolean;
  custom_dashboards_enabled: boolean;
  knowledge_base_enabled: boolean;
  support_level: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface Package {
  id: string;
  name: string;
  stripe_price_id: string | null; // Deprecated: use stripe_price_id_monthly
  stripe_product_id: string | null;
  pricing_model: 'per_user' | 'flat_rate';
  base_price_monthly: number | null;
  base_price_yearly: number | null;
  price_per_user_monthly: number | null;
  price_per_user_yearly: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  // Legacy fields for backward compatibility
  base_price: number | null;
  price_per_user: number | null;
  billing_interval: 'month' | 'year' | null;
  features: PackageFeatures;
  is_active: boolean;
  display_order: number;
}

export interface Subscription {
  id: string;
  organization_id: string;
  package_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_interval: 'month' | 'year' | null;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationContext {
  organization: Organization;
  subscription: Subscription | null;
  package: Package | null;
}

/**
 * Get user's organization from session
 * @param supabase - Supabase client instance
 * @param authUserId - Auth user ID from session
 * @returns Organization ID or null if not found
 */
export async function getUserOrganizationId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string | null> {
  try {
    // Try RPC function first (now fixed to avoid recursion)
    const { data: orgId, error: rpcError } = await supabase.rpc('user_organization_id');

    if (!rpcError && orgId) {
      return orgId;
    }

    // Fallback: Use admin client to avoid RLS recursion
    // Direct query to users table causes recursion in RLS policies
    if (rpcError) {
      logger.warn('[OrganizationContext] RPC user_organization_id failed, using admin client:', rpcError);
      const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
      const adminClient = createAdminSupabaseClient();
      const { data: user, error } = await adminClient
        .from('users')
        .select('organization_id')
        .eq('auth_id', authUserId)
        .single();

      if (error) {
        logger.error('[OrganizationContext] Error fetching user organization:', error);
        return null;
      }

      return user?.organization_id || null;
    }

    return null;
  } catch (error) {
    logger.error('[OrganizationContext] Error getting user organization:', error);
    return null;
  }
}

/**
 * Get full organization context by organization ID
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Organization context or null if not found
 */
export async function getOrganizationContextById(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrganizationContext | null> {
  try {
    // Use admin client to bypass RLS and avoid stack depth recursion issues
    // This is safe because we're filtering by organization_id which is application-level security
    const adminClient = createAdminSupabaseClient();
    
    // Parallelize organization and subscription queries (they don't depend on each other)
    const [orgResult, subResult] = await Promise.all([
      adminClient
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single(),
      adminClient
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: organization, error: orgError } = orgResult;
    let { data: subscription, error: subError } = subResult;

    if (orgError || !organization) {
      logger.error('[OrganizationContext] Error fetching organization:', orgError);
      return null;
    }

    // If no active/trialing subscription found, get the most recent subscription regardless of status
    // This ensures we can still load package features even if subscription is past_due or canceled
    if (!subscription && subError?.code === 'PGRST116') {
      logger.info('[OrganizationContext] No active/trialing subscription found, checking for any subscription');
      const { data: anySubscription, error: anySubError } = await adminClient
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anySubscription) {
        subscription = anySubscription;
        subError = null;
        logger.info('[OrganizationContext] Found subscription with status:', subscription.status);
      } else if (anySubError && anySubError.code !== 'PGRST116') {
        logger.error('[OrganizationContext] Error fetching any subscription:', anySubError);
        subError = anySubError;
      }
    }

    if (subError && subError.code !== 'PGRST116') {
      logger.error('[OrganizationContext] Error fetching subscription:', subError);
    }

    // Get package if subscription exists
    let packageData: Package | null = null;
    if (subscription?.package_id) {
      logger.info('[OrganizationContext] Loading package for subscription:', {
        subscriptionId: subscription.id,
        packageId: subscription.package_id,
        subscriptionStatus: subscription.status,
      });
      
      const { data: pkg, error: pkgError } = await adminClient
        .from('packages')
        .select('*')
        .eq('id', subscription.package_id)
        .single();

      if (pkgError) {
        logger.error('[OrganizationContext] Error fetching package:', {
          packageId: subscription.package_id,
          error: pkgError.message,
          code: pkgError.code,
        });
      } else if (pkg) {
        packageData = pkg as Package;
        logger.info('[OrganizationContext] Package loaded successfully:', {
          packageId: pkg.id,
          packageName: pkg.name,
          hasFeatures: !!pkg.features,
        });
      } else {
        logger.warn('[OrganizationContext] Package query returned no data:', {
          packageId: subscription.package_id,
        });
      }
    } else if (subscription) {
      logger.warn('[OrganizationContext] Subscription exists but has no package_id:', {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      });
    } else {
      logger.warn('[OrganizationContext] No subscription found for organization:', {
        organizationId,
      });
    }

    return {
      organization: organization as Organization,
      subscription: subscription as Subscription | null,
      package: packageData,
    };
  } catch (error) {
    logger.error('[OrganizationContext] Error getting organization context:', error);
    return null;
  }
}

/**
 * Get full organization context (organization, subscription, package)
 * @param supabase - Supabase client instance
 * @param authUserId - Auth user ID from session
 * @returns Organization context or null if not found
 */
export async function getOrganizationContext(
  supabase: SupabaseClient,
  authUserId: string
): Promise<OrganizationContext | null> {
  try {
    const orgId = await getUserOrganizationId(supabase, authUserId);
    if (!orgId) {
      return null;
    }

    return await getOrganizationContextById(supabase, orgId);
  } catch (error) {
    logger.error('[OrganizationContext] Error getting organization context:', error);
    return null;
  }
}

/**
 * Validate that a user has access to an organization
 * @param supabase - Supabase client instance
 * @param authUserId - Auth user ID from session
 * @param organizationId - Organization ID to validate
 * @returns True if user has access, false otherwise
 */
export async function validateOrganizationAccess(
  supabase: SupabaseClient,
  authUserId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Check if user is super admin (super admins can access all organizations)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role, is_super_admin, organization_id')
      .eq('auth_id', authUserId)
      .single();

    if (userError || !user) {
      return false;
    }

    // Super admins can access all organizations
    if (user.role === 'admin' && user.is_super_admin === true) {
      return true;
    }

    // Regular users can only access their own organization
    return user.organization_id === organizationId;
  } catch (error) {
    logger.error('[OrganizationContext] Error validating organization access:', error);
    return false;
  }
}

/**
 * Get organization package features
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Package features or null if not found
 */
export async function getOrganizationPackageFeatures(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PackageFeatures | null> {
  try {
    // Use admin client directly to bypass RLS and avoid stack depth recursion issues
    // This is safe because we're filtering by organization_id which is application-level security
    const adminClient = createAdminSupabaseClient();
    
    // Get subscription first
    let subscription;
    const { data: adminSubscription, error: adminSubError } = await adminClient
      .from('subscriptions')
      .select('package_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (adminSubError || !adminSubscription) {
      // Try any subscription if no active one
      const { data: anySubscription } = await adminClient
        .from('subscriptions')
        .select('package_id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      subscription = anySubscription;
    } else {
      subscription = adminSubscription;
    }

    if (!subscription?.package_id) {
      logger.warn('[OrganizationContext] No subscription found for organization:', { organizationId });
      return null;
    }

    // Get package features using admin client
    const { data: pkg, error: adminPkgError } = await adminClient
      .from('packages')
      .select('features')
      .eq('id', subscription.package_id)
      .single();

    if (adminPkgError || !pkg) {
      logger.error('[OrganizationContext] Error fetching package:', { 
        packageId: subscription.package_id, 
        error: adminPkgError 
      });
      return null;
    }

    return pkg.features as PackageFeatures | null;
  } catch (error) {
    logger.error('[OrganizationContext] Error getting package features:', error);
    return null;
  }
}

/**
 * Check if organization has access to a specific feature
 * Checks organization module_overrides first, then falls back to package features
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @param feature - Feature name to check
 * @returns True if feature is enabled, false otherwise
 */
export async function hasFeatureAccess(
  supabase: SupabaseClient,
  organizationId: string,
  feature: keyof PackageFeatures
): Promise<boolean> {
  try {
    // Use admin client to bypass RLS and avoid recursion issues
    // This is safe because we're filtering by organization_id which is application-level security
    const adminClient = createAdminSupabaseClient();
    
    // First check organization module_overrides
    // Use maybeSingle() to handle case where organization doesn't exist
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('module_overrides')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError && orgError.code !== 'PGRST116') {
      // Only log non-"not found" errors
      logger.warn('[hasFeatureAccess] Error fetching organization:', { organizationId, error: orgError });
    }
    
    // If organization doesn't exist, return false
    if (!organization) {
      logger.debug('[hasFeatureAccess] Organization not found:', { organizationId });
      return false;
    }

    if (organization?.module_overrides) {
      const overrides = organization.module_overrides as Record<string, boolean>;
      if (feature in overrides) {
        // Organization has an override for this feature
        return overrides[feature] === true;
      }
    }

    // Fall back to package features
    const features = await getOrganizationPackageFeatures(supabase, organizationId);
    if (!features) {
      logger.warn('[hasFeatureAccess] No package features found:', { organizationId, feature });
      return false;
    }

    const featureValue = features[feature];
    
    // For boolean features (ops_tool_enabled, ai_features_enabled, etc.), check if true
    // For numeric/null features (max_templates, max_projects, etc.), check if not undefined
    // null means unlimited/enabled for numeric features
    if (typeof featureValue === 'boolean') {
      return featureValue === true;
    }
    
    // For numeric/null features, undefined means no access, null or number means access
    return featureValue !== undefined;
  } catch (error) {
    logger.error('[OrganizationContext] Error checking feature access:', error);
    return false;
  }
}

/**
 * Get organization usage counts
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Usage counts object
 */
export async function getOrganizationUsage(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  projects: number;
  users: number;
  templates: number;
}> {
  try {
    // Use admin client to avoid RLS recursion issues
    const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
    const adminClient = createAdminSupabaseClient();
    
    const [projectsResult, usersResult, templatesResult] = await Promise.all([
      adminClient
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      adminClient
        .from('project_templates')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
    ]);

    return {
      projects: projectsResult.count || 0,
      users: usersResult.count || 0,
      templates: templatesResult.count || 0,
    };
  } catch (error) {
    logger.error('[OrganizationContext] Error getting organization usage:', error);
    return {
      projects: 0,
      users: 0,
      templates: 0,
    };
  }
}

/**
 * Helper function to get organization context from a request
 * This is a convenience function for API routes
 */
export async function getOrganizationContextFromRequest(): Promise<OrganizationContext | null> {
  try {
    // Lazy import to avoid pulling in next/headers in client components
    const { createServerSupabaseClient } = await import('@/lib/supabaseServer');
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    return await getOrganizationContext(supabase, user.id);
  } catch (error) {
    logger.error('[OrganizationContext] Error getting context from request:', error);
    return null;
  }
}

// Pricing utility functions moved to lib/packagePricing.ts
// to avoid importing server-only code in client components
// Re-export for backward compatibility
export { getPackagePrice, formatPackagePrice } from './packagePricing';

