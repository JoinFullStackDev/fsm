'use client';

import { useRole } from './useRole';
import { hasPermission, type Permission } from '@/lib/rbac';

/**
 * Custom hook to check if the current user has a specific permission
 * 
 * Uses the user's role to determine if they have the requested permission.
 * Returns loading state while the role is being fetched.
 * 
 * @param permission - The permission to check (e.g., 'manage_users', 'edit_project')
 * @returns Object containing:
 * - `hasPermission`: Boolean indicating if the user has the permission
 * - `loading`: Boolean indicating if the check is still in progress
 * 
 * @example
 * ```tsx
 * function AdminButton() {
 *   const { hasPermission, loading } = useHasPermission('manage_users');
 *   
 *   if (loading) return null;
 *   if (!hasPermission) return null;
 *   return <Button>Manage Users</Button>;
 * }
 * ```
 */
export function useHasPermission(permission: Permission) {
  const { role, loading } = useRole();

  if (loading || !role) {
    return { hasPermission: false, loading: true };
  }

  return {
    hasPermission: hasPermission(role, permission),
    loading: false,
  };
}

