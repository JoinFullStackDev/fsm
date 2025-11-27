'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createSupabaseClient } from '@/lib/supabaseClient';
import logger from '@/lib/utils/logger';
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

  const loadOrganizationContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setOrganization(null);
        setSubscription(null);
        setPackage(null);
        setLoading(false);
        return;
      }

      // Fetch organization context from API
      const response = await fetch('/api/organization/context');
      if (!response.ok) {
        throw new Error('Failed to load organization context');
      }

      const context: OrgContext = await response.json();

      setOrganization(context.organization);
      setSubscription(context.subscription);
      setPackage(context.package);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organization';
      setError(errorMessage);
      logger.error('[OrganizationProvider] Error loading organization context:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadOrganizationContext();

    // Listen for auth state changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadOrganizationContext();
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [loadOrganizationContext, supabase]);

  const refresh = useCallback(async () => {
    await loadOrganizationContext();
  }, [loadOrganizationContext]);

  const features = packageData?.features || null;

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

