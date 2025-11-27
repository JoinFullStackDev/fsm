import type { UserRole } from '@/types/project';

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
    'edit_phases',
    'export_blueprint',
  ],
  engineer: [
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

