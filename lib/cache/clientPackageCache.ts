/**
 * Client-side cache for organization package context
 * Uses localStorage to persist package/subscription info across page refreshes
 * Reduces database queries by caching package info client-side
 */

import type { OrganizationContext } from '@/lib/organizationContext';

interface CachedPackageData {
  data: OrganizationContext;
  timestamp: number;
  version: string; // For cache invalidation
  userId: string; // Security: ensure cache matches user
}

const CACHE_KEY_PREFIX = 'org_package_context_';
const CACHE_VERSION = '1.0';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - consider stale but usable

/**
 * Get cache key for a specific user
 */
function getCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

/**
 * Check if cache entry is valid (not expired and matches user)
 */
function isCacheValid(cached: CachedPackageData, userId: string): boolean {
  if (!cached || cached.userId !== userId) {
    return false;
  }

  const age = Date.now() - cached.timestamp;
  return age < CACHE_TTL_MS;
}

/**
 * Check if cache entry is stale but still usable
 */
function isCacheStale(cached: CachedPackageData): boolean {
  if (!cached) {
    return false;
  }

  const age = Date.now() - cached.timestamp;
  return age > STALE_THRESHOLD_MS && age < CACHE_TTL_MS;
}

/**
 * Get cached package context for a user
 * @param userId - Auth user ID
 * @returns Cached context or null if not found/invalid
 */
export function getCachedPackageContext(userId: string): OrganizationContext | null {
  if (typeof window === 'undefined') {
    // SSR: no localStorage available
    return null;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    const parsed: CachedPackageData = JSON.parse(cached);

    // Validate cache entry
    if (!isCacheValid(parsed, userId)) {
      // Remove invalid cache
      localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.data;
  } catch (error) {
    // Invalid JSON or other error - clear cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(getCacheKey(userId));
      } catch {
        // Ignore errors during cleanup
      }
    }
    return null;
  }
}

/**
 * Set cached package context for a user
 * @param userId - Auth user ID
 * @param context - Organization context to cache
 */
export function setCachedPackageContext(userId: string, context: OrganizationContext): void {
  if (typeof window === 'undefined') {
    // SSR: no localStorage available
    return;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const cacheData: CachedPackageData = {
      data: context,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      userId,
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    // localStorage might be full or disabled - silently fail
    // This is not critical, app will still work without cache
    console.warn('[ClientPackageCache] Failed to set cache:', error);
  }
}

/**
 * Clear cached package context for a user
 * @param userId - Auth user ID (optional, clears all if not provided)
 */
export function clearCachedPackageContext(userId?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (userId) {
      // Clear specific user's cache
      localStorage.removeItem(getCacheKey(userId));
    } else {
      // Clear all package context caches
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  } catch (error) {
    // Silently fail - not critical
    console.warn('[ClientPackageCache] Failed to clear cache:', error);
  }
}

/**
 * Check if cached data exists and is stale (but still usable)
 * @param userId - Auth user ID
 * @returns True if cache exists and is stale
 */
export function isCachedDataStale(userId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return false;
    }

    const parsed: CachedPackageData = JSON.parse(cached);
    return isCacheStale(parsed);
  } catch {
    return false;
  }
}

/**
 * Get cache age in milliseconds
 * @param userId - Auth user ID
 * @returns Age in ms, or null if cache doesn't exist
 */
export function getCacheAge(userId: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cacheKey = getCacheKey(userId);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    const parsed: CachedPackageData = JSON.parse(cached);
    return Date.now() - parsed.timestamp;
  } catch {
    return null;
  }
}

