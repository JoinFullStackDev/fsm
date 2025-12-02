import type { Permission } from '@/lib/rbac';

export interface OrganizationRole {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission: Permission;
  created_at: string;
}

export interface UserOrganizationRole {
  id: string;
  user_id: string;
  role_id: string;
  organization_id: string;
  created_at: string;
}

export interface OrganizationRoleWithPermissions extends OrganizationRole {
  permissions: Permission[];
  user_count?: number;
}

