'use client';

import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabaseClient';
import logger from '@/lib/utils/logger';
import type { UserRole } from '@/types/project';

/**
 * Custom hook to get the current user's role
 * 
 * Fetches the user's role from the database based on their Supabase auth session.
 * Includes fallback logic to find users by email if auth_id lookup fails.
 * 
 * @returns Object containing:
 * - `role`: The user's role ('admin', 'pm', 'designer', 'engineer') or null if not found
 * - `loading`: Boolean indicating if the role is still being fetched
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { role, loading } = useRole();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (role === 'admin') return <AdminPanel />;
 *   return <RegularView />;
 * }
 * ```
 */
export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseClient();
    
    const loadRole = async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      logger.debug('[useRole] Session check:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        sessionError: sessionError?.message 
      });

      if (!session) {
        logger.debug('[useRole] No session found');
        setLoading(false);
        return;
      }

      logger.debug('[useRole] Looking up user with auth_id:', session.user.id);
      
      // Use API endpoint to avoid RLS recursion
      const userResponse = await fetch('/api/users/me');
      if (!userResponse.ok) {
        logger.error('[useRole] Failed to fetch user:', userResponse.status);
        setLoading(false);
        return;
      }
      
      const userData = await userResponse.json();
      logger.debug('[useRole] User query result:', { 
        userData, 
        queryAuthId: session.user.id
      });

      if (userData) {
        logger.debug('[useRole] User role loaded successfully:', userData.role);
        setRole(userData.role as UserRole);
        setIsSuperAdmin(userData.is_super_admin || false);
        setIsCompanyAdmin(userData.is_company_admin || false);
      } else {
        logger.warn('[useRole] No user data found for auth_id:', session.user.id);
      }
      setLoading(false);
    };

    loadRole();
  }, []); // Empty dependency array - only run once on mount

  return { role, isSuperAdmin, isCompanyAdmin, loading };
}

