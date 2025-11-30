/**
 * Package limits enforcement
 * Functions to check if organization can create more resources and validate feature access
 */

import { createServerSupabaseClient } from '@/lib/supabaseServer';
import {
  getOrganizationContextById,
  getOrganizationUsage,
  hasFeatureAccess,
  type PackageFeatures,
} from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number | null;
}

/**
 * Check if organization can create more projects
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Limit check result
 */
export async function canCreateProject(
  supabase: SupabaseClient,
  organizationId: string
): Promise<LimitCheckResult> {
  try {
    const context = await getOrganizationContextById(supabase, organizationId);
    if (!context || !context.package) {
      return {
        allowed: false,
        reason: 'No active subscription found',
      };
    }

    const features = context.package.features;
    const maxProjects = features.max_projects;

    // null means unlimited
    if (maxProjects === null) {
      return { allowed: true };
    }

    const usage = await getOrganizationUsage(supabase, organizationId);
    const current = usage.projects;

    if (current >= maxProjects) {
      return {
        allowed: false,
        reason: `Project limit reached. Maximum ${maxProjects} projects allowed.`,
        current,
        limit: maxProjects,
      };
    }

    return {
      allowed: true,
      current,
      limit: maxProjects,
    };
  } catch (error) {
    logger.error('[PackageLimits] Error checking project limit:', error);
    return {
      allowed: false,
      reason: 'Error checking project limit',
    };
  }
}

/**
 * Check if organization can add more users
 * For company admins adding users via /admin page, users can be added even at limit
 * (they will be charged per-user pricing). This function now allows adding users
 * even when at max_users limit, but returns a warning.
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @param allowPaidUsers - If true, allow adding users even at limit (for paid users)
 * @returns Limit check result
 */
export async function canAddUser(
  supabase: SupabaseClient,
  organizationId: string,
  allowPaidUsers: boolean = true
): Promise<LimitCheckResult> {
  try {
    const context = await getOrganizationContextById(supabase, organizationId);
    if (!context || !context.package) {
      return {
        allowed: false,
        reason: 'No active subscription found',
      };
    }

    const features = context.package.features;
    const maxUsers = features.max_users;

    // null means unlimited
    if (maxUsers === null) {
      return { allowed: true };
    }

    const usage = await getOrganizationUsage(supabase, organizationId);
    const current = usage.users;

    // If at or over limit
    if (current >= maxUsers) {
      // If allowPaidUsers is true (default for admin user creation), allow adding but with warning
      if (allowPaidUsers) {
        return {
          allowed: true,
          reason: `You have reached the package limit of ${maxUsers} users. Adding more users will increase your monthly subscription cost.`,
          current,
          limit: maxUsers,
        };
      }
      // Otherwise, block (for other flows that shouldn't allow exceeding limits)
      return {
        allowed: false,
        reason: `User limit reached. Maximum ${maxUsers} users allowed.`,
        current,
        limit: maxUsers,
      };
    }

    return {
      allowed: true,
      current,
      limit: maxUsers,
    };
  } catch (error) {
    logger.error('[PackageLimits] Error checking user limit:', error);
    return {
      allowed: false,
      reason: 'Error checking user limit',
    };
  }
}

/**
 * Check if organization can add a paid user (allows exceeding max_users limit)
 * This is specifically for company admin user creation flow
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Limit check result with warning if at limit
 */
export async function canAddPaidUser(
  supabase: SupabaseClient,
  organizationId: string
): Promise<LimitCheckResult> {
  return canAddUser(supabase, organizationId, true);
}

/**
 * Check if organization can create more templates
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Limit check result
 */
export async function canCreateTemplate(
  supabase: SupabaseClient,
  organizationId: string
): Promise<LimitCheckResult> {
  try {
    const context = await getOrganizationContextById(supabase, organizationId);
    if (!context || !context.package) {
      return {
        allowed: false,
        reason: 'No active subscription found',
      };
    }

    const features = context.package.features;
    const maxTemplates = features.max_templates;

    // null means unlimited
    if (maxTemplates === null) {
      return { allowed: true };
    }

    const usage = await getOrganizationUsage(supabase, organizationId);
    const current = usage.templates;

    if (current >= maxTemplates) {
      return {
        allowed: false,
        reason: `Template limit reached. Maximum ${maxTemplates} templates allowed.`,
        current,
        limit: maxTemplates,
      };
    }

    return {
      allowed: true,
      current,
      limit: maxTemplates,
    };
  } catch (error) {
    logger.error('[PackageLimits] Error checking template limit:', error);
    return {
      allowed: false,
      reason: 'Error checking template limit',
    };
  }
}

/**
 * Check if organization has access to AI features
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns True if AI features are enabled
 */
export async function hasAIFeatures(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  return hasFeatureAccess(supabase, organizationId, 'ai_features_enabled');
}

/**
 * Check if organization has access to export features
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns True if export features are enabled
 */
export async function hasExportFeatures(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  return hasFeatureAccess(supabase, organizationId, 'export_features_enabled');
}

/**
 * Check if organization has access to ops tool
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns True if ops tool is enabled
 */
export async function hasOpsTool(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  return hasFeatureAccess(supabase, organizationId, 'ops_tool_enabled');
}

/**
 * Check if organization has access to analytics
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns True if analytics are enabled
 */
export async function hasAnalytics(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  return hasFeatureAccess(supabase, organizationId, 'analytics_enabled');
}

/**
 * Check if organization has API access
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns True if API access is enabled
 */
export async function hasAPIAccess(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  return hasFeatureAccess(supabase, organizationId, 'api_access_enabled');
}

/**
 * Check if organization has access to custom dashboards
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns True if custom dashboards are enabled
 */
export async function hasCustomDashboards(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  return hasFeatureAccess(supabase, organizationId, 'custom_dashboards_enabled');
}

/**
 * Get organization's support level
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Support level or null if not found
 */
export async function getSupportLevel(
  supabase: SupabaseClient,
  organizationId: string
): Promise<'community' | 'email' | 'priority' | 'dedicated' | null> {
  try {
    const context = await getOrganizationContextById(supabase, organizationId);
    if (!context || !context.package) {
      return null;
    }

    return context.package.features.support_level;
  } catch (error) {
    logger.error('[PackageLimits] Error getting support level:', error);
    return null;
  }
}

/**
 * Get all package limits for an organization
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Package limits object
 */
export async function getAllLimits(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  projects: LimitCheckResult;
  users: LimitCheckResult;
  templates: LimitCheckResult;
  features: {
    ai: boolean;
    export: boolean;
    opsTool: boolean;
    analytics: boolean;
    apiAccess: boolean;
    customDashboards: boolean;
  };
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated' | null;
}> {
  const [projects, users, templates, ai, export_, opsTool, analytics, apiAccess, customDashboards, supportLevel] =
    await Promise.all([
      canCreateProject(supabase, organizationId),
      canAddUser(supabase, organizationId),
      canCreateTemplate(supabase, organizationId),
      hasAIFeatures(supabase, organizationId),
      hasExportFeatures(supabase, organizationId),
      hasOpsTool(supabase, organizationId),
      hasAnalytics(supabase, organizationId),
      hasAPIAccess(supabase, organizationId),
      hasCustomDashboards(supabase, organizationId),
      getSupportLevel(supabase, organizationId),
    ]);

  return {
    projects,
    users,
    templates,
    features: {
      ai,
      export: export_,
      opsTool,
      analytics,
      apiAccess,
      customDashboards,
    },
    supportLevel,
  };
}

