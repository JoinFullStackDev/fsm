import type { UserRole } from '@/types/project';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Permission = 
  | 'view_all_projects'
  | 'manage_users'
  | 'create_projects'
  | 'edit_project'
  | 'delete_project'
  | 'edit_phases'
  | 'export_blueprint'
  | 'export_cursor'
  | 'manage_project_members';

export type ProjectMemberRole = 'admin' | 'pm' | 'designer' | 'engineer';

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_all_projects',
    'manage_users',
    'create_projects',
    'edit_project',
    'delete_project',
    'edit_phases',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  pm: [
    'view_all_projects',
    'create_projects',
    'edit_project',
    'delete_project',
    'edit_phases',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  designer: [
    'view_all_projects',
    'create_projects',
    'edit_phases',
    'export_blueprint',
  ],
  engineer: [
    'view_all_projects',
    'create_projects',
    'edit_phases',
    'export_blueprint',
    'export_cursor',
  ],
};

// Project member role permissions (for project-specific access)
// Note: Project members get full access to all phases regardless of role
const PROJECT_MEMBER_PERMISSIONS: Record<ProjectMemberRole, Permission[]> = {
  admin: [
    'edit_project',
    'delete_project',
    'edit_phases',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  pm: [
    'edit_project',
    'edit_phases',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  designer: [
    'edit_phases',
    'export_blueprint',
  ],
  engineer: [
    'edit_phases',
    'export_blueprint',
    'export_cursor',
  ],
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

/**
 * Check if a project member role has a specific permission
 */
export function hasProjectPermission(
  memberRole: ProjectMemberRole,
  permission: Permission
): boolean {
  return PROJECT_MEMBER_PERMISSIONS[memberRole]?.includes(permission) ?? false;
}

/**
 * Check if a user can edit a specific phase based on their role
 * @param userRole - The user's role
 * @param phaseNumber - The phase number to check (kept for API compatibility but not used)
 * @param isProjectMember - Optional: whether the user is a project member (owner or member)
 */
export function canEditPhase(
  userRole: UserRole, 
  phaseNumber: number, 
  isProjectMember?: boolean
): boolean {
  // Admins can always edit all phases
  if (userRole === 'admin') {
    return true;
  }
  
  // Project members (owners or members) can edit all phases
  if (isProjectMember === true) {
    return true;
  }
  
  // For non-members, check if they have the general 'edit_phases' permission
  return hasPermission(userRole, 'edit_phases');
}

/**
 * Check if a project member can edit a specific phase
 * Project members can always edit all phases
 */
export function canProjectMemberEditPhase(
  memberRole: ProjectMemberRole,
  phaseNumber: number
): boolean {
  // All project members can edit all phases
  return true;
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] ?? [];
}

/**
 * Get all permissions for a project member role
 */
export function getProjectMemberPermissions(memberRole: ProjectMemberRole): Permission[] {
  return PROJECT_MEMBER_PERMISSIONS[memberRole] ?? [];
}

/**
 * Get all permissions for a user (primary role + custom roles)
 * @param supabase - Supabase client instance
 * @param userId - User database ID
 * @param organizationId - Organization ID
 * @returns Array of all permissions the user has
 */
export async function getUserPermissions(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<Permission[]> {
  try {
    // Get user's primary role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return [];
    }

    const primaryRole = user.role as UserRole;
    const permissions = new Set<Permission>(ROLE_PERMISSIONS[primaryRole] ?? []);

    // Get custom roles assigned to user
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        organization_roles!inner(
          id,
          role_permissions(permission)
        )
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (!rolesError && userRoles) {
      // Add permissions from custom roles
      for (const userRole of userRoles) {
        const orgRole = userRole.organization_roles as any;
        if (orgRole?.role_permissions) {
          for (const perm of orgRole.role_permissions) {
            permissions.add(perm.permission as Permission);
          }
        }
      }
    }

    return Array.from(permissions);
  } catch (error) {
    console.error('[RBAC] Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if a user has a specific permission (checks primary role + custom roles)
 * @param supabase - Supabase client instance
 * @param userId - User database ID
 * @param organizationId - Organization ID
 * @param permission - Permission to check
 * @returns True if user has the permission
 */
export async function hasUserPermission(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const permissions = await getUserPermissions(supabase, userId, organizationId);
  return permissions.includes(permission);
}

/**
 * Get all roles for a user (primary role + custom roles)
 * @param supabase - Supabase client instance
 * @param userId - User database ID
 * @param organizationId - Organization ID
 * @returns Array of role objects with id, name, and isDefault flag
 */
export async function getUserRoles(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
  try {
    const roles: Array<{ id: string; name: string; isDefault: boolean }> = [];

    // Get user's primary role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!userError && user) {
      const primaryRole = user.role as UserRole;
      
      // Find the default role record for this organization
      const { data: defaultRole } = await supabase
        .from('organization_roles')
        .select('id, name, is_default')
        .eq('organization_id', organizationId)
        .eq('name', primaryRole)
        .eq('is_default', true)
        .single();

      if (defaultRole) {
        roles.push({
          id: defaultRole.id,
          name: defaultRole.name,
          isDefault: true,
        });
      }
    }

    // Get custom roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        organization_roles!inner(
          id,
          name,
          is_default
        )
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (!rolesError && userRoles) {
      for (const userRole of userRoles) {
        const orgRole = userRole.organization_roles as any;
        if (orgRole) {
          roles.push({
            id: orgRole.id,
            name: orgRole.name,
            isDefault: orgRole.is_default,
          });
        }
      }
    }

    return roles;
  } catch (error) {
    console.error('[RBAC] Error getting user roles:', error);
    return [];
  }
}

