/**
 * Smart cache invalidation utilities
 * Provides functions to invalidate related cache entries when data changes
 */

import { redisDel, redisDelPattern } from './redis';
import { queryCache } from './queryCache';
import { CACHE_KEYS } from './cacheKeys';
import logger from '@/lib/utils/logger';

/**
 * Invalidate organization-related caches
 */
export async function invalidateOrganizationCache(orgId: string, userId?: string): Promise<void> {
  try {
    // Invalidate organization context for all users in the org
    // Note: In production, you might want to track which users belong to the org
    if (userId) {
      await redisDel(CACHE_KEYS.organizationContext(userId));
      queryCache.invalidate(CACHE_KEYS.organizationContext(userId));
    }
    
    await redisDel(CACHE_KEYS.organizationById(orgId));
    await redisDel(CACHE_KEYS.organizationRoles(orgId));
    await redisDel(CACHE_KEYS.subscription(orgId));
    
    queryCache.invalidate(`org:${orgId}`);
    queryCache.invalidate(`org:${orgId}:roles`);
    queryCache.invalidate(`org:${orgId}:subscription`);
    
    logger.debug('[Cache] Invalidated organization cache', { orgId, userId });
  } catch (error) {
    logger.error('[Cache] Error invalidating organization cache:', error);
  }
}

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCache(userId: string, authId?: string): Promise<void> {
  try {
    if (authId) {
      await redisDel(CACHE_KEYS.userByAuthId(authId));
      queryCache.invalidate(CACHE_KEYS.userByAuthId(authId));
    }
    
    await redisDel(CACHE_KEYS.userById(userId));
    await redisDelPattern(CACHE_KEYS.userProjects(userId));
    await redisDelPattern(CACHE_KEYS.userNotifications(userId));
    
    queryCache.invalidate(`user:${userId}`);
    queryCache.invalidate(`user:${userId}:projects`);
    
    logger.debug('[Cache] Invalidated user cache', { userId, authId });
  } catch (error) {
    logger.error('[Cache] Error invalidating user cache:', error);
  }
}

/**
 * Invalidate project-related caches
 */
export async function invalidateProjectCache(projectId: string, orgId?: string): Promise<void> {
  try {
    await redisDel(CACHE_KEYS.projectById(projectId));
    await redisDel(CACHE_KEYS.projectPhases(projectId));
    await redisDel(CACHE_KEYS.projectMembers(projectId));
    
    queryCache.invalidate(`project:${projectId}`);
    queryCache.invalidate(`project:${projectId}:phases`);
    queryCache.invalidate(`project:${projectId}:members`);
    
    // Invalidate user project lists for all members
    // Note: In production, you might want to track project members
    if (orgId) {
      await redisDelPattern(CACHE_KEYS.userProjects('*'));
      queryCache.invalidate(`user:*:projects`);
    }
    
    logger.debug('[Cache] Invalidated project cache', { projectId, orgId });
  } catch (error) {
    logger.error('[Cache] Error invalidating project cache:', error);
  }
}

/**
 * Invalidate role and permission caches
 */
export async function invalidateRoleCache(roleId: string, orgId?: string): Promise<void> {
  try {
    await redisDel(CACHE_KEYS.rolePermissions(roleId));
    queryCache.invalidate(`role:${roleId}:permissions`);
    
    if (orgId) {
      await redisDel(CACHE_KEYS.organizationRoles(orgId));
      await redisDelPattern(CACHE_KEYS.userPermissions('*', orgId));
      queryCache.invalidate(`org:${orgId}:roles`);
      queryCache.invalidate(`user:*:org:${orgId}:permissions`);
    }
    
    logger.debug('[Cache] Invalidated role cache', { roleId, orgId });
  } catch (error) {
    logger.error('[Cache] Error invalidating role cache:', error);
  }
}

/**
 * Invalidate subscription and package caches
 */
export async function invalidateSubscriptionCache(orgId: string): Promise<void> {
  try {
    await redisDel(CACHE_KEYS.subscription(orgId));
    await redisDel(CACHE_KEYS.organizationContext('*')); // Invalidate all org contexts
    queryCache.invalidate(`org:${orgId}:subscription`);
    queryCache.invalidate(`org:*:context`);
    
    logger.debug('[Cache] Invalidated subscription cache', { orgId });
  } catch (error) {
    logger.error('[Cache] Error invalidating subscription cache:', error);
  }
}

/**
 * Invalidate package cache
 */
export async function invalidatePackageCache(packageId: string): Promise<void> {
  try {
    await redisDel(CACHE_KEYS.package(packageId));
    queryCache.invalidate(`package:${packageId}`);
    
    // Also invalidate all subscriptions that use this package
    await redisDelPattern(CACHE_KEYS.subscription('*'));
    queryCache.invalidate(`org:*:subscription`);
    
    logger.debug('[Cache] Invalidated package cache', { packageId });
  } catch (error) {
    logger.error('[Cache] Error invalidating package cache:', error);
  }
}

/**
 * Invalidate notification caches
 */
export async function invalidateNotificationCache(userId: string): Promise<void> {
  try {
    await redisDel(CACHE_KEYS.userNotifications(userId));
    await redisDel(CACHE_KEYS.unreadCount(userId));
    queryCache.invalidate(`notifications:${userId}`);
    queryCache.invalidate(`notifications:${userId}:unread`);
    
    logger.debug('[Cache] Invalidated notification cache', { userId });
  } catch (error) {
    logger.error('[Cache] Error invalidating notification cache:', error);
  }
}

/**
 * Invalidate all caches (use with caution - mainly for testing/debugging)
 */
export async function invalidateAllCaches(): Promise<void> {
  try {
    queryCache.clear();
    // Note: Redis pattern deletion is expensive, use sparingly
    logger.warn('[Cache] All caches invalidated');
  } catch (error) {
    logger.error('[Cache] Error invalidating all caches:', error);
  }
}

