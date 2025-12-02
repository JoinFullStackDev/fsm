/**
 * Organization Roles utility functions
 * Provides helpers for managing organization-specific custom roles and permissions
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from './supabaseAdmin';
import logger from './utils/logger';
import type { OrganizationRole, OrganizationRoleWithPermissions } from '@/types/organizationRoles';
import type { Permission } from '@/lib/rbac';
import type { Permission as RBACPermission } from './rbac';

const VALID_PERMISSIONS: RBACPermission[] = [
  'view_all_projects',
  'manage_users',
  'create_projects',
  'edit_project',
  'delete_project',
  'edit_phases',
  'export_blueprint',
  'export_cursor',
  'manage_project_members',
];

/**
 * Get all roles for an organization
 * @param supabase - Supabase client instance
 * @param organizationId - Organization ID
 * @returns Array of roles with permissions
 */
export async function getOrganizationRoles(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrganizationRoleWithPermissions[]> {
  try {
    const { data: roles, error } = await supabase
      .from('organization_roles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      logger.error('[OrganizationRoles] Error fetching roles:', error);
      return [];
    }

    if (!roles || roles.length === 0) {
      return [];
    }

    // Get permissions for each role and user counts
    const rolesWithPermissions: OrganizationRoleWithPermissions[] = await Promise.all(
      roles.map(async (role) => {
        // Get permissions
        const { data: permissions } = await supabase
          .from('role_permissions')
          .select('permission')
          .eq('role_id', role.id);

        // Get user count
        const { count } = await supabase
          .from('user_organization_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id);

        return {
          ...role,
          permissions: (permissions?.map(p => p.permission as Permission) ?? []) as Permission[],
          user_count: count ?? 0,
        };
      })
    );

    return rolesWithPermissions;
  } catch (error) {
    logger.error('[OrganizationRoles] Error getting organization roles:', error);
    return [];
  }
}

/**
 * Get a single role with permissions
 * @param supabase - Supabase client instance
 * @param roleId - Role ID
 * @returns Role with permissions or null
 */
export async function getRole(
  supabase: SupabaseClient,
  roleId: string
): Promise<OrganizationRoleWithPermissions | null> {
  try {
    const { data: role, error } = await supabase
      .from('organization_roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (error || !role) {
      logger.error('[OrganizationRoles] Error fetching role:', error);
      return null;
    }

    // Get permissions
    const { data: permissions } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('role_id', roleId);

    // Get user count
    const { count } = await supabase
      .from('user_organization_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId);

    return {
      ...role,
      permissions: (permissions?.map(p => p.permission as Permission) ?? []) as Permission[],
      user_count: count ?? 0,
    };
  } catch (error) {
    logger.error('[OrganizationRoles] Error getting role:', error);
    return null;
  }
}

/**
 * Create a new custom organization role
 * @param supabase - Supabase client instance (should be admin client for writes)
 * @param organizationId - Organization ID
 * @param name - Role name (must be unique within organization)
 * @param description - Role description
 * @param permissions - Array of permissions to assign
 * @returns Created role or null
 */
export async function createOrganizationRole(
  supabase: SupabaseClient,
  organizationId: string,
  name: string,
  description: string | null,
  permissions: RBACPermission[]
): Promise<OrganizationRoleWithPermissions | null> {
  try {
    // Validate permissions
    const invalidPermissions = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      logger.error('[OrganizationRoles] Invalid permissions:', invalidPermissions);
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Check if role name already exists
    const { data: existing } = await supabase
      .from('organization_roles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', name)
      .single();

    if (existing) {
      throw new Error(`Role "${name}" already exists in this organization`);
    }

    // Create role
    const { data: role, error: roleError } = await supabase
      .from('organization_roles')
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        is_default: false,
      })
      .select()
      .single();

    if (roleError || !role) {
      logger.error('[OrganizationRoles] Error creating role:', roleError);
      throw roleError || new Error('Failed to create role');
    }

    // Add permissions
    if (permissions.length > 0) {
      const permissionInserts = permissions.map(permission => ({
        role_id: role.id,
        permission,
      }));

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(permissionInserts);

      if (permError) {
        logger.error('[OrganizationRoles] Error adding permissions:', permError);
        // Rollback role creation
        await supabase.from('organization_roles').delete().eq('id', role.id);
        throw permError;
      }
    }

    return {
      ...role,
      permissions: permissions as Permission[],
      user_count: 0,
    };
  } catch (error) {
    logger.error('[OrganizationRoles] Error creating organization role:', error);
    throw error;
  }
}

/**
 * Update role name and description
 * @param supabase - Supabase client instance (should be admin client for writes)
 * @param roleId - Role ID
 * @param name - New role name
 * @param description - New role description
 * @returns Updated role or null
 */
export async function updateRole(
  supabase: SupabaseClient,
  roleId: string,
  name: string,
  description: string | null
): Promise<OrganizationRole | null> {
  try {
    // Check if role exists and is not default
    const { data: existing } = await supabase
      .from('organization_roles')
      .select('is_default, organization_id')
      .eq('id', roleId)
      .single();

    if (!existing) {
      throw new Error('Role not found');
    }

    if (existing.is_default) {
      throw new Error('Cannot modify default roles');
    }

    // Check if new name conflicts with existing role
    const { data: conflict } = await supabase
      .from('organization_roles')
      .select('id')
      .eq('organization_id', existing.organization_id)
      .eq('name', name.trim())
      .neq('id', roleId)
      .single();

    if (conflict) {
      throw new Error(`Role "${name}" already exists in this organization`);
    }

    const { data: role, error } = await supabase
      .from('organization_roles')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roleId)
      .select()
      .single();

    if (error || !role) {
      logger.error('[OrganizationRoles] Error updating role:', error);
      throw error || new Error('Failed to update role');
    }

    return role;
  } catch (error) {
    logger.error('[OrganizationRoles] Error updating role:', error);
    throw error;
  }
}

/**
 * Update permissions for a role
 * @param supabase - Supabase client instance (should be admin client for writes)
 * @param roleId - Role ID
 * @param permissions - Array of permissions (replaces all existing permissions)
 * @returns True if successful
 */
export async function updateRolePermissions(
  supabase: SupabaseClient,
  roleId: string,
  permissions: RBACPermission[]
): Promise<boolean> {
  try {
    // Validate permissions
    const invalidPermissions = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Check if role exists and is not default
    const { data: role } = await supabase
      .from('organization_roles')
      .select('is_default')
      .eq('id', roleId)
      .single();

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.is_default) {
      throw new Error('Cannot modify permissions for default roles');
    }

    // Delete existing permissions
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {
      logger.error('[OrganizationRoles] Error deleting existing permissions:', deleteError);
      throw deleteError;
    }

    // Insert new permissions
    if (permissions.length > 0) {
      const permissionInserts = permissions.map(permission => ({
        role_id: roleId,
        permission,
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(permissionInserts);

      if (insertError) {
        logger.error('[OrganizationRoles] Error inserting permissions:', insertError);
        throw insertError;
      }
    }

    return true;
  } catch (error) {
    logger.error('[OrganizationRoles] Error updating role permissions:', error);
    throw error;
  }
}

/**
 * Delete a custom role
 * @param supabase - Supabase client instance (should be admin client for writes)
 * @param roleId - Role ID
 * @returns True if successful
 */
export async function deleteRole(
  supabase: SupabaseClient,
  roleId: string
): Promise<boolean> {
  try {
    // Check if role exists and is not default
    const { data: role } = await supabase
      .from('organization_roles')
      .select('is_default')
      .eq('id', roleId)
      .single();

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.is_default) {
      throw new Error('Cannot delete default roles');
    }

    // Check if any users are assigned to this role
    const { count } = await supabase
      .from('user_organization_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId);

    if (count && count > 0) {
      throw new Error(`Cannot delete role: ${count} user(s) are assigned to this role`);
    }

    // Delete role (permissions will be cascade deleted)
    const { error } = await supabase
      .from('organization_roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      logger.error('[OrganizationRoles] Error deleting role:', error);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('[OrganizationRoles] Error deleting role:', error);
    throw error;
  }
}

/**
 * Assign a custom role to a user
 * @param supabase - Supabase client instance (should be admin client for writes)
 * @param userId - User ID
 * @param roleId - Role ID
 * @param organizationId - Organization ID
 * @returns True if successful
 */
export async function assignRoleToUser(
  supabase: SupabaseClient,
  userId: string,
  roleId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Verify role belongs to organization
    const { data: role } = await supabase
      .from('organization_roles')
      .select('organization_id')
      .eq('id', roleId)
      .single();

    if (!role || role.organization_id !== organizationId) {
      throw new Error('Role does not belong to this organization');
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .single();

    if (existing) {
      return true; // Already assigned
    }

    // Create assignment
    const { error } = await supabase
      .from('user_organization_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        organization_id: organizationId,
      });

    if (error) {
      logger.error('[OrganizationRoles] Error assigning role:', error);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('[OrganizationRoles] Error assigning role to user:', error);
    throw error;
  }
}

/**
 * Remove a custom role from a user
 * @param supabase - Supabase client instance (should be admin client for writes)
 * @param userId - User ID
 * @param roleId - Role ID
 * @returns True if successful
 */
export async function removeRoleFromUser(
  supabase: SupabaseClient,
  userId: string,
  roleId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_organization_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) {
      logger.error('[OrganizationRoles] Error removing role:', error);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('[OrganizationRoles] Error removing role from user:', error);
    throw error;
  }
}

/**
 * Get all custom roles assigned to a user
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns Array of role IDs
 */
export async function getUserCustomRoles(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<string[]> {
  try {
    const { data: assignments, error } = await supabase
      .from('user_organization_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('[OrganizationRoles] Error getting user custom roles:', error);
      return [];
    }

    return assignments?.map(a => a.role_id) ?? [];
  } catch (error) {
    logger.error('[OrganizationRoles] Error getting user custom roles:', error);
    return [];
  }
}

/**
 * Check if user can manage roles (company admin)
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns True if user can manage roles
 */
export async function canManageRoles(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_company_admin, organization_id')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return false;
    }

    return user.is_company_admin === true && user.organization_id === organizationId;
  } catch (error) {
    logger.error('[OrganizationRoles] Error checking role management permission:', error);
    return false;
  }
}

