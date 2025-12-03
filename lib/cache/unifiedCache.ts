/**
 * Unified cache wrapper
 * Provides a single interface that uses Redis (if available) with in-memory fallback
 * Implements a two-tier caching strategy: Redis -> In-Memory -> Database
 */

import { redisGet, redisSet, redisDel, isRedisEnabled } from './redis';
import { queryCache } from './queryCache';
import { CACHE_KEYS, CACHE_TTL } from './cacheKeys';
import logger from '@/lib/utils/logger';

// Re-export for convenience
export { CACHE_KEYS, CACHE_TTL } from './cacheKeys';

/**
 * Get cached value from unified cache (Redis -> In-Memory)
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds?: number
): Promise<T | null> {
  // Try Redis first if available
  if (await isRedisEnabled()) {
    try {
      const value = await redisGet<T>(key);
      if (value !== null) {
        // Also populate in-memory cache for faster subsequent access
        if (ttlSeconds) {
          queryCache.set(key, value, ttlSeconds);
        }
        return value;
      }
    } catch (error) {
      logger.warn('[UnifiedCache] Redis get failed, falling back to in-memory:', error);
    }
  }

  // Fall back to in-memory cache
  return queryCache.get<T>(key);
}

/**
 * Set cached value in unified cache (Redis + In-Memory)
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = CACHE_TTL.MEDIUM
): Promise<void> {
  // Set in Redis if available
  if (await isRedisEnabled()) {
    try {
      await redisSet(key, value, ttlSeconds);
    } catch (error) {
      logger.warn('[UnifiedCache] Redis set failed, using in-memory only:', error);
    }
  }

  // Always set in in-memory cache for fast access
  queryCache.set(key, value, ttlSeconds);
}

/**
 * Delete cached value from unified cache
 */
export async function cacheDel(key: string): Promise<void> {
  // Delete from Redis if available
  if (await isRedisEnabled()) {
    try {
      await redisDel(key);
    } catch (error) {
      logger.warn('[UnifiedCache] Redis delete failed:', error);
    }
  }

  // Delete from in-memory cache
  queryCache.invalidate(key);
}

/**
 * Get or set cached value with async factory function
 * Useful for caching async database queries
 */
export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key, ttlSeconds);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - call factory function
  try {
    const value = await factory();
    await cacheSet(key, value, ttlSeconds);
    return value;
  } catch (error) {
    logger.error('[UnifiedCache] Factory function failed:', error);
    throw error;
  }
}

/**
 * Invalidate cache entries matching a pattern
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  // Invalidate in Redis (if pattern-based deletion is supported)
  // Note: Redis pattern deletion is expensive, so we'll invalidate specific keys
  // For now, we'll rely on TTL and manual invalidation
  
  // Invalidate in-memory cache
  queryCache.invalidate(pattern);
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const inMemoryStats = queryCache.getStats();
  
  return {
    redis: {
      enabled: await isRedisEnabled(),
    },
    inMemory: inMemoryStats,
  };
}

