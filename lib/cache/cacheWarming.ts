/**
 * Cache warming utilities
 * Preloads frequently accessed data into cache on user login or app initialization
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { cacheSet, CACHE_KEYS, CACHE_TTL } from './unifiedCache';
import logger from '@/lib/utils/logger';

/**
 * Warm cache for a user on login
 * Preloads organization context, role permissions, and project list
 */
export async function warmUserCache(userId: string, authId: string, organizationId: string): Promise<void> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    // Warm organization context
    const orgContextKey = CACHE_KEYS.organizationContext(authId);
    // Note: Organization context will be loaded on first API call, but we can preload it here
    
    // Warm role permissions for all roles in the organization
    const { data: roles } = await adminClient
      .from('organization_roles')
      .select('id')
      .eq('organization_id', organizationId);
    
    if (roles) {
      const permissionPromises = roles.map(async (role) => {
        const permissionsKey = CACHE_KEYS.rolePermissions(role.id);
        const { data: permissions } = await adminClient
          .from('role_permissions')
          .select('permission')
          .eq('role_id', role.id);
        
        if (permissions) {
          await cacheSet(permissionsKey, permissions, CACHE_TTL.ROLE_PERMISSIONS);
        }
      });
      
      await Promise.all(permissionPromises);
    }
    
    // Warm user's project list
    const userProjectsKey = CACHE_KEYS.userProjects(userId);
    const { data: projectMembers } = await adminClient
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);
    
    if (projectMembers) {
      const projectIds = projectMembers.map((pm) => pm.project_id);
      await cacheSet(userProjectsKey, projectIds, CACHE_TTL.USER_PROJECTS);
    }
    
    logger.debug('[CacheWarming] User cache warmed', { userId, organizationId });
  } catch (error) {
    logger.error('[CacheWarming] Error warming user cache:', error);
    // Don't throw - cache warming is best effort
  }
}

/**
 * Warm cache for a project
 * Preloads project phases and members
 */
export async function warmProjectCache(projectId: string): Promise<void> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    // Warm project phases
    const phasesKey = CACHE_KEYS.projectPhases(projectId);
    const { data: phases } = await adminClient
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (phases) {
      await cacheSet(phasesKey, phases, CACHE_TTL.PROJECT_PHASES);
    }
    
    // Warm project members
    const membersKey = CACHE_KEYS.projectMembers(projectId);
    const { data: members } = await adminClient
      .from('project_members')
      .select(`
        id,
        user_id,
        role,
        user:users!project_members_user_id_fkey (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    
    if (members) {
      await cacheSet(membersKey, members, CACHE_TTL.PROJECT_MEMBERS);
    }
    
    logger.debug('[CacheWarming] Project cache warmed', { projectId });
  } catch (error) {
    logger.error('[CacheWarming] Error warming project cache:', error);
    // Don't throw - cache warming is best effort
  }
}

