/**
 * Organization context utilities
 * Provides functions to get user organization, validate access, and check package limits
 */

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageFeatures {
  max_projects: number | null;
  max_users: number | null;
  max_templates: number | null;
  ai_features_enabled: boolean;
  export_features_enabled: boolean;
  ops_tool_enabled: boolean;
  analytics_enabled: boolean;
  api_access_enabled: boolean;
  support_level: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface Package {
  id: string;
  name: string;
  stripe_price_id: string | null;
  price_per_user_monthly: number;
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
    const { data: user, error } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', authUserId)
      .single();

    if (error) {
      logger.error('[OrganizationContext] Error fetching user organization:', error);
      return null;
    }

    return user?.organization_id || null;
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
    // Get organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      logger.error('[OrganizationContext] Error fetching organization:', orgError);
      return null;
    }

    // Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError && subError.code !== 'PGRST116') {
      logger.error('[OrganizationContext] Error fetching subscription:', subError);
    }

    // Get package if subscription exists
    let packageData: Package | null = null;
    if (subscription?.package_id) {
      const { data: pkg, error: pkgError } = await supabase
        .from('packages')
        .select('*')
        .eq('id', subscription.package_id)
        .single();

      if (pkgError) {
        logger.error('[OrganizationContext] Error fetching package:', pkgError);
      } else {
        packageData = pkg as Package;
      }
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
    const context = await getOrganizationContextById(supabase, organizationId);
    if (!context || !context.package) {
      return null;
    }

    return context.package.features;
  } catch (error) {
    logger.error('[OrganizationContext] Error getting package features:', error);
    return null;
  }
}

/**
 * Check if organization has access to a specific feature
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
    const features = await getOrganizationPackageFeatures(supabase, organizationId);
    if (!features) {
      return false;
    }

    return features[feature] === true || features[feature] === null; // null means unlimited/enabled
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
    const [projectsResult, usersResult, templatesResult] = await Promise.all([
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      supabase
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
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return null;
    }

    return await getOrganizationContext(supabase, session.user.id);
  } catch (error) {
    logger.error('[OrganizationContext] Error getting context from request:', error);
    return null;
  }
}

