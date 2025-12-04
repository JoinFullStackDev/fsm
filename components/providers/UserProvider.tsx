'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
import { createSupabaseClient } from '@/lib/supabaseClient';
import logger from '@/lib/utils/logger';
import type { User } from '@/types/project';

/**
 * Context type for user data
 */
interface UserContextType {
  /** Current user */
  user: User | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh user data */
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * User Provider Component
 *
 * Provides user information to child components.
 * Automatically fetches user data on mount and caches it to prevent redundant API calls.
 *
 * @param children - Child components that can use the user context
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseClient();
  const loadingRef = useRef(false); // Request deduplication: prevent multiple simultaneous requests
  const abortControllerRef = useRef<AbortController | null>(null); // Track abort controller for cancellation
  const cacheRef = useRef<{ user: User | null; timestamp: number } | null>(null);
  const CACHE_TTL_MS = 30000; // 30 seconds cache on client side

  const loadUser = useCallback(async () => {
    // Request deduplication: if already loading, skip
    if (loadingRef.current) {
      return;
    }

    // Check cache first
    const now = Date.now();
    if (cacheRef.current && (now - cacheRef.current.timestamp) < CACHE_TTL_MS) {
      setUser(cacheRef.current.user);
      setLoading(false);
      return;
    }

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        setLoading(false);
        loadingRef.current = false;
        cacheRef.current = null;
        return;
      }

      // Fetch user data from API with timeout
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch('/api/users/me', {
          signal: controller.signal,
          cache: 'default', // Use browser cache
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error('Failed to load user data');
        }

        const userData: User = await response.json();
        setUser(userData);
        cacheRef.current = { user: userData, timestamp: now };
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          // Request was aborted (deduplication or timeout) - don't show error
          logger.warn('[UserProvider] User data request aborted');
          return; // Exit early, don't throw
        } else {
          throw fetchErr;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user data';
      setError(errorMessage);
      logger.error('[UserProvider] Error loading user data:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [supabase]);

  const refresh = useCallback(async () => {
    // Clear cache and reload
    cacheRef.current = null;
    await loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        cacheRef.current = null;
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Clear cache and reload user data
        cacheRef.current = null;
        loadUser();
      }
    });

    return () => {
      subscription.unsubscribe();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadUser, supabase]);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    refresh,
  }), [user, loading, error, refresh]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Hook to use user context
 */
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

