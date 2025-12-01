/**
 * Shared cache for organization context
 * Allows cache invalidation from multiple API routes
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const contextCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export function getCachedContext(userId: string): any | null {
  const cached = contextCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    contextCache.delete(userId); // Remove expired entry
  }
  return null;
}

export function setCachedContext(userId: string, data: any): void {
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

