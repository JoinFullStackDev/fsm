'use client';

import { useMemo } from 'react';
import { useUser } from '@/components/providers/UserProvider';
import type { UserRole } from '@/types/project';

/**
 * Custom hook to get the current user's role
 * 
 * Uses UserProvider to get user data (no redundant API calls).
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
  const { user, loading } = useUser();

  return useMemo(() => ({
    role: (user?.role as UserRole) || null,
    isSuperAdmin: user?.is_super_admin || false,
    isCompanyAdmin: user?.is_company_admin || false,
    loading,
  }), [user, loading]);
}

