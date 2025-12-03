/**
 * Performance monitoring utilities
 * Tracks cache hit rates, query execution times, and API response times
 */

import { getCacheStats } from '@/lib/cache/unifiedCache';
import { queryCache } from '@/lib/cache/queryCache';
import logger from '@/lib/utils/logger';

interface PerformanceMetrics {
  cache: {
    redis: {
      enabled: boolean;
    };
    inMemory: {
      size: number;
      maxSize: number;
      hits: number;
      misses: number;
      hitRate: number;
    };
  };
  timestamp: number;
}

/**
 * Get current performance metrics
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  const cacheStats = await getCacheStats();
  
  return {
    cache: cacheStats,
    timestamp: Date.now(),
  };
}

/**
 * Log performance metrics (useful for monitoring)
 */
export async function logPerformanceMetrics(): Promise<void> {
  const metrics = await getPerformanceMetrics();
  
  logger.info('[Performance] Metrics:', {
    cache: {
      redisEnabled: metrics.cache.redis.enabled,
      inMemory: {
        size: metrics.cache.inMemory.size,
        maxSize: metrics.cache.inMemory.maxSize,
        hitRate: `${metrics.cache.inMemory.hitRate.toFixed(2)}%`,
        hits: metrics.cache.inMemory.hits,
        misses: metrics.cache.inMemory.misses,
      },
    },
  });
}

/**
 * Track API response time
 */
export function trackApiResponseTime(
  endpoint: string,
  duration: number,
  statusCode: number
): void {
  // Log slow requests (> 500ms)
  if (duration > 500) {
    logger.warn('[Performance] Slow API request:', {
      endpoint,
      duration: `${duration}ms`,
      statusCode,
    });
  }
  
  // Log very slow requests (> 1000ms)
  if (duration > 1000) {
    logger.error('[Performance] Very slow API request:', {
      endpoint,
      duration: `${duration}ms`,
      statusCode,
    });
  }
}

/**
 * Track database query time
 */
export function trackQueryTime(
  query: string,
  duration: number,
  rowsReturned: number
): void {
  // Log slow queries (> 100ms)
  if (duration > 100) {
    logger.warn('[Performance] Slow database query:', {
      query: query.substring(0, 100), // Truncate for logging
      duration: `${duration}ms`,
      rowsReturned,
    });
  }
}

/**
 * Middleware to track API response times
 */
export function withPerformanceTracking<T>(
  handler: () => Promise<T>,
  endpoint: string
): Promise<T> {
  const startTime = Date.now();
  
  return handler()
    .then((result) => {
      const duration = Date.now() - startTime;
      trackApiResponseTime(endpoint, duration, 200);
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      const statusCode = error.status || 500;
      trackApiResponseTime(endpoint, duration, statusCode);
      throw error;
    });
}

