/**
 * Query Cache Utility
 * Enhanced in-memory cache with TTL, LRU eviction, and size limits
 * 
 * Safety: Cache can be disabled via environment variable
 * Rollback: Set ENABLE_QUERY_CACHE=false to disable caching
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
  lastAccessed: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private accessOrder: string[] = []; // LRU tracking
  private enabled: boolean;
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor() {
    // Allow disabling cache via environment variable for debugging/rollback
    this.enabled = process.env.ENABLE_QUERY_CACHE !== 'false';
    // Max cache size (default: 1000 entries)
    this.maxSize = parseInt(process.env.QUERY_CACHE_MAX_SIZE || '1000', 10);
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    if (!this.enabled) {
      this.misses++;
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    entry.lastAccessed = Date.now();
    this.hits++;
    return entry.data as T;
  }

  /**
   * Set cached data with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    // Evict if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
      lastAccessed: Date.now(),
    });
    
    this.updateAccessOrder(key);
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

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });
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
  getStats(): { 
    size: number; 
    maxSize: number;
    keys: string[]; 
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
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

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      // Fallback: evict oldest entry by expiration
      let oldestKey: string | null = null;
      let oldestExpiry = Infinity;
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires < oldestExpiry) {
          oldestExpiry = entry.expires;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.removeFromAccessOrder(oldestKey);
      }
      return;
    }

    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
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
