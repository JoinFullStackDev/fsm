/**
 * Centralized cache key management
 * Ensures consistent cache key naming across the application
 */

export const CACHE_KEYS = {
  // Organization context cache keys
  organizationContext: (userId: string) => `org:context:${userId}`,
  organizationById: (orgId: string) => `org:${orgId}`,
  
  // User cache keys
  userById: (userId: string) => `user:${userId}`,
  userByAuthId: (authId: string) => `user:auth:${authId}`,
  
  // Project cache keys
  projectById: (projectId: string) => `project:${projectId}`,
  projectPhases: (projectId: string) => `project:${projectId}:phases`,
  projectPhase: (projectId: string, phaseNumber: number) => `project:${projectId}:phase:${phaseNumber}`,
  projectMembers: (projectId: string) => `project:${projectId}:members`,
  projectFieldConfigs: (projectId: string) => `project:${projectId}:fieldConfigs`,
  projectTasks: (projectId: string) => `project:${projectId}:tasks`,
  userProjects: (userId: string) => `user:${userId}:projects`,
  
  // Role and permission cache keys
  rolePermissions: (roleId: string) => `role:${roleId}:permissions`,
  userPermissions: (userId: string, orgId: string) => `user:${userId}:org:${orgId}:permissions`,
  organizationRoles: (orgId: string) => `org:${orgId}:roles`,
  
  // Subscription and package cache keys
  subscription: (orgId: string) => `org:${orgId}:subscription`,
  package: (packageId: string) => `package:${packageId}`,
  
  // Dashboard cache keys
  dashboard: (dashboardId: string) => `dashboard:${dashboardId}`,
  dashboardWidgets: (dashboardId: string) => `dashboard:${dashboardId}:widgets`,
  
  // Notification cache keys
  userNotifications: (userId: string) => `notifications:${userId}`,
  unreadCount: (userId: string) => `notifications:${userId}:unread`,
} as const;

/**
 * Cache TTL constants (in seconds)
 */
export const CACHE_TTL = {
  // Short-lived cache (frequently changing data)
  SHORT: 30, // 30 seconds
  
  // Medium cache (moderately changing data)
  MEDIUM: 300, // 5 minutes
  
  // Long cache (rarely changing data)
  LONG: 3600, // 1 hour
  
  // Very long cache (static or rarely changing data)
  VERY_LONG: 86400, // 24 hours
  
  // Specific TTLs
  ORGANIZATION_CONTEXT: 300, // 5 minutes
  ROLE_PERMISSIONS: 600, // 10 minutes
  PROJECT_PHASES: 120, // 2 minutes
  PROJECT_PHASE: 60, // 1 minute (single phase data)
  PROJECT_MEMBERS: 60, // 1 minute
  PROJECT_FIELD_CONFIGS: 300, // 5 minutes (template configs rarely change)
  PROJECT_TASKS: 30, // 30 seconds (tasks change frequently)
  USER_PROJECTS: 180, // 3 minutes
  SUBSCRIPTION: 300, // 5 minutes
  PACKAGE: 3600, // 1 hour (packages rarely change)
} as const;

/**
 * Generate cache key with prefix
 */
export function getCacheKey(key: string, prefix?: string): string {
  const baseKey = prefix ? `${prefix}:${key}` : key;
  return baseKey;
}

/**
 * Generate cache key pattern for invalidation
 */
export function getCachePattern(pattern: string): string {
  return `${pattern}*`;
}

