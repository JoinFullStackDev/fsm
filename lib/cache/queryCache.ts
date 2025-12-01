/**
 * Query Cache Utility
 * Simple in-memory cache with TTL for frequently accessed data
 * 
 * Safety: Cache can be disabled via environment variable
 * Rollback: Set ENABLE_QUERY_CACHE=false to disable caching
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private enabled: boolean;

  constructor() {
    // Allow disabling cache via environment variable for debugging/rollback
    this.enabled = process.env.ENABLE_QUERY_CACHE !== 'false';
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    if (!this.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidate cache entries matching a pattern
   * Pattern can be a prefix or exact match
   */
  invalidate(pattern: string): void {
    if (!this.enabled) {
      return;
    }

    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern) || key === pattern) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Singleton instance
export const queryCache = new QueryCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    queryCache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Generate cache key from function name and parameters
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
}
