import type { UserRole } from '@/types/project';

export type Permission = 
  | 'view_all_projects'
  | 'manage_users'
  | 'create_projects'
  | 'edit_project'
  | 'delete_project'
  | 'edit_phase_1'
  | 'edit_phase_2'
  | 'edit_phase_3'
  | 'edit_phase_4'
  | 'edit_phase_5'
  | 'edit_phase_6'
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
    'edit_phase_1',
    'edit_phase_2',
    'edit_phase_3',
    'edit_phase_4',
    'edit_phase_5',
    'edit_phase_6',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  pm: [
    'view_all_projects',
    'create_projects',
    'edit_project',
    'delete_project',
    'edit_phase_1',
    'edit_phase_2',
    'edit_phase_3',
    'edit_phase_4',
    'edit_phase_5',
    'edit_phase_6',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  designer: [
    'edit_phase_3',
    'export_blueprint',
  ],
  engineer: [
    'edit_phase_4',
    'edit_phase_5',
    'edit_phase_6',
    'export_blueprint',
    'export_cursor',
  ],
};

// Project member role permissions (for project-specific access)
const PROJECT_MEMBER_PERMISSIONS: Record<ProjectMemberRole, Permission[]> = {
  admin: [
    'edit_project',
    'delete_project',
    'edit_phase_1',
    'edit_phase_2',
    'edit_phase_3',
    'edit_phase_4',
    'edit_phase_5',
    'edit_phase_6',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  pm: [
    'edit_project',
    'edit_phase_1',
    'edit_phase_2',
    'edit_phase_3',
    'edit_phase_4',
    'export_blueprint',
    'export_cursor',
    'manage_project_members',
  ],
  designer: [
    'edit_phase_3',
    'export_blueprint',
  ],
  engineer: [
    'edit_phase_4',
    'edit_phase_5',
    'edit_phase_6',
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
 * @param phaseNumber - The phase number to check
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
  
  // For phases beyond 6, use flexible permission logic
  if (phaseNumber > 6) {
    // For other roles, check if they have edit permissions for any phase
    // If they can edit phases 1-6, they can likely edit additional phases too
    // This is a reasonable default for dynamic phases
    return hasPermission(userRole, 'edit_phase_1') || 
           hasPermission(userRole, 'edit_phase_2') || 
           hasPermission(userRole, 'edit_phase_3') || 
           hasPermission(userRole, 'edit_phase_4') || 
           hasPermission(userRole, 'edit_phase_5') || 
           hasPermission(userRole, 'edit_phase_6');
  }
  
  // For phases 1-6, use the specific permission
  const phasePermission = `edit_phase_${phaseNumber}` as Permission;
  return hasPermission(userRole, phasePermission);
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

