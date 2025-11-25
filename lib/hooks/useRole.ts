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
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  useEffect(() => {
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
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, role, auth_id')
        .eq('auth_id', session.user.id)
        .single();

      logger.debug('[useRole] User query result:', { 
        userData, 
        userError: userError?.message,
        queryAuthId: session.user.id
      });

      if (userError) {
        logger.error('[useRole] Error loading user role:', userError);
        // Try to find user by email as fallback
        if (session.user.email) {
          logger.debug('[useRole] Trying fallback lookup by email:', session.user.email);
          const { data: emailUserData, error: emailError } = await supabase
            .from('users')
            .select('id, email, role, auth_id')
            .eq('email', session.user.email)
            .single();
          
          logger.debug('[useRole] Email lookup result:', { emailUserData, emailError: emailError?.message });
          
          if (emailUserData) {
            logger.debug('[useRole] Found user by email, auth_id mismatch detected!');
            logger.debug('[useRole] Database auth_id:', emailUserData.auth_id, 'Session user id:', session.user.id);
            setRole(emailUserData.role as UserRole);
            setLoading(false);
            return;
          }
        }
        setLoading(false);
        return;
      }

      if (userData) {
        logger.debug('[useRole] User role loaded successfully:', userData.role);
        setRole(userData.role as UserRole);
      } else {
        logger.warn('[useRole] No user data found for auth_id:', session.user.id);
      }
      setLoading(false);
    };

    loadRole();
  }, [supabase]);

  return { role, loading };
}

