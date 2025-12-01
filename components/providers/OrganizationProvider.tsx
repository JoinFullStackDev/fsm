'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { createSupabaseClient } from '@/lib/supabaseClient';
import logger from '@/lib/utils/logger';
import { AVAILABLE_MODULES } from '@/lib/modules';
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

  const loadOrganizationContext = useCallback(async () => {
    // Request deduplication: if already loading, skip
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setOrganization(null);
        setSubscription(null);
        setPackage(null);
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      // Fetch organization context from API with timeout
      const controller = new AbortController();
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

        setOrganization(context.organization);
        setSubscription(context.subscription);
        setPackage(context.package);
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          logger.warn('[OrganizationProvider] Organization context request timed out');
          // Don't set error - allow app to continue without organization context
          setOrganization(null);
          setSubscription(null);
          setPackage(null);
        } else {
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
    }
  }, [supabase]);

  useEffect(() => {
    loadOrganizationContext();

    // Listen for auth state changes with debouncing
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(() => {
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
    };
  }, [loadOrganizationContext, supabase]);

  const refresh = useCallback(async () => {
    await loadOrganizationContext();
  }, [loadOrganizationContext]);

  // Merge package features with organization module_overrides
  // Organization overrides take precedence over package features
  const features = useMemo(() => {
    if (!packageData?.features) {
      return null;
    }

    const baseFeatures = { ...packageData.features };
    
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

