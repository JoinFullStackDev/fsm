/**
 * Shared cache for organization context
 * Allows cache invalidation from multiple API routes
 */

// Generic cache entry - stores any organization context type
interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

const contextCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (increased from 30 seconds for better performance)

export function getCachedContext<T = unknown>(userId: string): T | null {
  const cached = contextCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  if (cached) {
    contextCache.delete(userId); // Remove expired entry
  }
  return null;
}

export function setCachedContext<T = unknown>(userId: string, data: T): void {
  contextCache.set(userId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  
  // Clean up expired entries periodically (keep cache size reasonable)
  if (contextCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of contextCache.entries()) {
      if (value.expiresAt <= now) {
        contextCache.delete(key);
      }
    }
  }
}

export function clearCachedContext(userId: string): void {
  contextCache.delete(userId);
}

export function clearCachedContextsForOrganization(organizationId: string, userAuthIds: string[]): void {
  // Clear cache for all users in the organization
  userAuthIds.forEach((authId) => {
    if (authId) {
      contextCache.delete(authId);
    }
  });
}

export function clearAllCachedContexts(): void {
  contextCache.clear();
}

