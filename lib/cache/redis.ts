/**
 * Redis/Upstash cache client wrapper
 * Provides a unified interface for caching with fallback to in-memory cache
 * 
 * Environment variables:
 * - UPSTASH_REDIS_REST_URL: Upstash Redis REST API URL
 * - UPSTASH_REDIS_REST_TOKEN: Upstash Redis REST API token
 * - ENABLE_REDIS_CACHE: Set to 'false' to disable Redis (defaults to enabled if env vars exist)
 */

import logger from '@/lib/utils/logger';

// Optional Redis import - will be null if package is not installed
// Using dynamic import to avoid build errors if package is not installed
let RedisClass: any = undefined;

// Lazy load Redis class
async function loadRedis(): Promise<any> {
  if (RedisClass !== undefined) {
    return RedisClass;
  }
  
  try {
    const redisModule = await import('@upstash/redis');
    if (!redisModule || !redisModule.Redis) {
      logger.warn('[Redis] @upstash/redis module loaded but Redis class not found');
      RedisClass = null;
      return null;
    }
    RedisClass = redisModule.Redis;
    logger.debug('[Redis] @upstash/redis package loaded successfully');
    return RedisClass;
  } catch (error: any) {
    // @upstash/redis not installed or import failed - Redis will be disabled
    RedisClass = null;
    const errorMsg = error?.message || String(error);
    logger.debug('[Redis] @upstash/redis import failed - Redis caching disabled', { 
      error: errorMsg,
      code: error?.code 
    });
    return null;
  }
}

let redisClient: any | null = null;
let redisEnabled = false;

/**
 * Initialize Redis client
 */
async function initRedisClient(): Promise<any | null> {
  if (redisClient) {
    return redisClient;
  }

  // Load Redis class if not already loaded
  const Redis = await loadRedis();
  
  // Check if Redis class is available
  if (!Redis) {
    logger.debug('[Redis] @upstash/redis package not installed - Redis caching disabled');
    redisEnabled = false;
    return null;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const enableRedis = process.env.ENABLE_REDIS_CACHE !== 'false';

  if (!redisUrl || !redisToken) {
    logger.debug('[Redis] Redis not configured - UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set');
    redisEnabled = false;
    return null;
  }

  if (!enableRedis) {
    logger.debug('[Redis] Redis cache disabled via ENABLE_REDIS_CACHE=false');
    redisEnabled = false;
    return null;
  }

  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    redisEnabled = true;
    logger.info('[Redis] Redis client initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('[Redis] Failed to initialize Redis client:', error);
    redisEnabled = false;
    return null;
  }
}

/**
 * Get Redis client instance
 */
export async function getRedisClient(): Promise<any | null> {
  return await initRedisClient();
}

/**
 * Check if Redis is enabled and available
 */
export async function isRedisEnabled(): Promise<boolean> {
  if (!redisEnabled) {
    await initRedisClient();
  }
  return redisEnabled && redisClient !== null;
}

/**
 * Get cached value from Redis
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  if (!(await isRedisEnabled())) {
    return null;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const value = await client.get(key);
    return value as T | null;
  } catch (error) {
    logger.error('[Redis] Error getting key:', { key, error });
    return null;
  }
}

/**
 * Set cached value in Redis with TTL
 */
export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<boolean> {
  if (!(await isRedisEnabled())) {
    return false;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    if (ttlSeconds && ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (error) {
    logger.error('[Redis] Error setting key:', { key, error });
    return false;
  }
}

/**
 * Delete cached value from Redis
 */
export async function redisDel(key: string): Promise<boolean> {
  if (!(await isRedisEnabled())) {
    return false;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    await client.del(key);
    return true;
  } catch (error) {
    logger.error('[Redis] Error deleting key:', { key, error });
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * Note: This uses SCAN which may be slow for large key sets
 */
export async function redisDelPattern(pattern: string): Promise<number> {
  if (!(await isRedisEnabled())) {
    return 0;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return 0;
    }

    // Upstash Redis doesn't support KEYS command, so we need to use SCAN
    // For now, we'll delete keys one by one if we know the pattern
    // In production, consider using a more efficient approach
    let deleted = 0;
    let cursor = 0;
    
    do {
      const result = await client.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      const keys = result[1] as string[];
      
      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== 0);

    return deleted;
  } catch (error) {
    logger.error('[Redis] Error deleting pattern:', { pattern, error });
    return 0;
  }
}

/**
 * Check if key exists in Redis
 */
export async function redisExists(key: string): Promise<boolean> {
  if (!(await isRedisEnabled())) {
    return false;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('[Redis] Error checking key existence:', { key, error });
    return false;
  }
}

/**
 * Get TTL for a key
 */
export async function redisTtl(key: string): Promise<number> {
  if (!(await isRedisEnabled())) {
    return -1;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return -1;
    }

    return await client.ttl(key);
  } catch (error) {
    logger.error('[Redis] Error getting TTL:', { key, error });
    return -1;
  }
}

/**
 * Increment a counter (useful for metrics)
 */
export async function redisIncr(key: string): Promise<number> {
  if (!(await isRedisEnabled())) {
    return 0;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return 0;
    }

    return await client.incr(key);
  } catch (error) {
    logger.error('[Redis] Error incrementing key:', { key, error });
    return 0;
  }
}

