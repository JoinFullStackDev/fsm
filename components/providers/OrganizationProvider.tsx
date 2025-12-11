'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import { AVAILABLE_MODULES } from '@/lib/modules';
import {
  getCachedPackageContext,
  setCachedPackageContext,
  clearCachedPackageContext,
  isCachedDataStale,
} from '@/lib/cache/clientPackageCache';
import type {
  Organization,
  Package,
  Subscription,
  OrganizationContext as OrgContext,
} from '@/lib/organizationContext';
import type { PackageFeatures } from '@/lib/organizationContext';

/**
 * Context type for organization data
 */
interface OrganizationContextType {
  /** Current organization */
  organization: Organization | null;
  /** Current subscription */
  subscription: Subscription | null;
  /** Current package */
  package: Package | null;
  /** Package features */
  features: PackageFeatures | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh organization data */
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

/**
 * Organization Provider Component
 *
 * Provides organization, subscription, and package information to child components.
 * Automatically fetches organization context on mount and when user changes.
 *
 * @param children - Child components that can use the organization context
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [packageData, setPackage] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseClient();
  const loadingRef = useRef(false); // Request deduplication: prevent multiple simultaneous requests
  const abortControllerRef = useRef<AbortController | null>(null); // Track abort controller for cancellation

  const loadOrganizationContext = useCallback(async () => {
    // Request deduplication: if already loading, skip
    if (loadingRef.current) {
      return;
    }

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      loadingRef.current = true;
      setError(null);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        // Clear cache on logout
        clearCachedPackageContext();
        setOrganization(null);
        setSubscription(null);
        setPackage(null);
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      // Check cache first for instant UI
      const cachedContext = getCachedPackageContext(authUser.id);
      const hasCachedData = !!cachedContext;
      const isStale = hasCachedData && isCachedDataStale(authUser.id);

      if (cachedContext) {
        // Parse module_overrides if needed
        if (cachedContext.organization?.module_overrides && typeof cachedContext.organization.module_overrides === 'string') {
          try {
            cachedContext.organization.module_overrides = JSON.parse(cachedContext.organization.module_overrides);
          } catch {
            cachedContext.organization.module_overrides = null;
          }
        }

        // Set cached data immediately for instant UI
        setOrganization(cachedContext.organization);
        setSubscription(cachedContext.subscription);
        setPackage(cachedContext.package);
        
        // If cache is fresh, we can set loading to false immediately
        // Otherwise, keep loading true to show we're refreshing
        if (!isStale) {
          setLoading(false);
        }
      } else {
        // No cache - show loading state
        setLoading(true);
      }

      // Always fetch fresh data in background (stale-while-revalidate pattern)
      const controller = new AbortController();
      abortControllerRef.current = controller; // Store for potential cancellation
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch('/api/organization/context', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error('Failed to load organization context');
        }

        const context: OrgContext = await response.json();

        // Ensure module_overrides is properly parsed if it's a string
        if (context.organization?.module_overrides && typeof context.organization.module_overrides === 'string') {
          try {
            context.organization.module_overrides = JSON.parse(context.organization.module_overrides);
          } catch {
            context.organization.module_overrides = null;
          }
        }

        // Update state with fresh data
        setOrganization(context.organization);
        setSubscription(context.subscription);
        setPackage(context.package);

        // Update cache with fresh data
        setCachedPackageContext(authUser.id, context);
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          // Request was aborted (deduplication or timeout)
          logger.warn('[OrganizationProvider] Organization context request aborted');
          
          // If we have cached data, keep using it
          if (hasCachedData) {
            setLoading(false);
            return; // Exit early, keep cached data
          }
          
          // No cache and request aborted - clear state
          setOrganization(null);
          setSubscription(null);
          setPackage(null);
          return; // Exit early, don't throw
        } else {
          // Fetch failed - if we have cached data, use it as fallback
          if (hasCachedData) {
            logger.warn('[OrganizationProvider] Fetch failed, using cached data as fallback');
            setLoading(false);
            return; // Use cached data, don't show error
          }
          
          // No cache and fetch failed - show error
          throw fetchErr;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organization';
      setError(errorMessage);
      logger.error('[OrganizationProvider] Error loading organization context:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      abortControllerRef.current = null; // Clear abort controller
    }
  }, [supabase]);

  useEffect(() => {
    loadOrganizationContext();

    // Listen for auth state changes with debouncing
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      // Clear cache on sign out or user change
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Get current user before clearing
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          clearCachedPackageContext(currentUser.id);
        } else {
          // No user - clear all caches
          clearCachedPackageContext();
        }
      }

      // Debounce auth state changes to prevent rapid-fire requests
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        loadOrganizationContext();
      }, 300); // 300ms debounce
    });

    return () => {
      authSubscription.unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      // Cleanup: abort any in-flight requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadOrganizationContext, supabase]);

  const refresh = useCallback(async () => {
    await loadOrganizationContext();
  }, [loadOrganizationContext]);

  // Merge package features with organization module_overrides
  // Organization overrides take precedence over package features
  const features = useMemo(() => {
    // Start with package features OR empty object if no package
    const baseFeatures = packageData?.features 
      ? { ...packageData.features } 
      : {
          max_projects: null,
          max_users: null,
          max_templates: null,
          ai_features_enabled: false,
          ai_task_generator_enabled: false,
          export_features_enabled: false,
          ops_tool_enabled: false,
          analytics_enabled: false,
          api_access_enabled: false,
          custom_dashboards_enabled: false,
          knowledge_base_enabled: false,
          workflows_enabled: false,
          product_workspace_enabled: false,
          slack_integration_enabled: false,
          support_level: 'community' as const,
        };
    
    // Apply organization module_overrides if they exist
    if (organization?.module_overrides) {
      let overrides: Record<string, boolean>;
      
      // Handle JSONB from database (could be object or string)
      if (typeof organization.module_overrides === 'string') {
        try {
          overrides = JSON.parse(organization.module_overrides);
        } catch {
          overrides = {};
        }
      } else if (typeof organization.module_overrides === 'object') {
        overrides = organization.module_overrides as Record<string, boolean>;
      } else {
        overrides = {};
      }
      
      // Only apply overrides for module keys (feature flags that are booleans)
      Object.keys(overrides).forEach((key) => {
        // Override if it's a boolean feature in PackageFeatures, OR if it's a valid module key
        // This allows module overrides to work even if the package doesn't include the feature
        if (key in baseFeatures && typeof (baseFeatures as any)[key] === 'boolean') {
          (baseFeatures as any)[key] = overrides[key] === true;
        } else {
          // Check if it's a valid module key (from AVAILABLE_MODULES)
          // This allows module overrides to work even if the package doesn't include the feature
          const moduleExists = AVAILABLE_MODULES.some(m => m.key === key);
          if (moduleExists) {
            // Add the override as a new feature (for modules not in package)
            (baseFeatures as any)[key] = overrides[key] === true;
          }
        }
      });
    }

    return baseFeatures;
  }, [packageData?.features, organization?.module_overrides]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        subscription,
        package: packageData,
        features,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access organization context
 *
 * Must be used within an OrganizationProvider component.
 *
 * @returns Organization context with organization, subscription, package, and features
 * @throws Error if used outside OrganizationProvider (only in browser, not during SSR)
 */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    // During SSR/static generation, return a default context instead of throwing
    if (typeof window === 'undefined') {
      return {
        organization: null,
        subscription: null,
        package: null,
        features: null,
        loading: true,
        error: null,
        refresh: async () => {},
      };
    }
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

