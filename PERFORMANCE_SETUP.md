# Performance Optimization Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install @upstash/redis
```

### 2. Set Up Upstash Redis (Optional but Recommended)

1. Create a free account at https://upstash.com
2. Create a new Redis database
3. Copy the REST URL and token
4. Add to your `.env.local` file:

```env
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
ENABLE_REDIS_CACHE=true
```

**Note:** If Redis is not configured, the system will automatically fall back to in-memory caching.

### 3. Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `migrations/schema/add_performance_indexes.sql`
3. Run the migration

### 4. Verify Installation

The optimizations are now active! The system will:
- Cache frequently accessed data automatically
- Use Redis if configured, otherwise use in-memory cache
- Optimize realtime subscriptions
- Batch queries where possible

## Monitoring Performance

### Check Cache Statistics

You can monitor cache performance using:

```typescript
import { getPerformanceMetrics } from '@/lib/monitoring/performance';

const metrics = getPerformanceMetrics();
console.log('Cache hit rate:', metrics.cache.inMemory.hitRate);
```

### Analyze Slow Queries

Run the query analysis script in Supabase SQL Editor:

```sql
-- See scripts/analyze-slow-queries.sql
```

## Configuration

### Environment Variables

- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL (optional)
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token (optional)
- `ENABLE_REDIS_CACHE` - Set to 'false' to disable Redis (defaults to enabled if env vars exist)
- `ENABLE_QUERY_CACHE` - Set to 'false' to disable all caching (defaults to enabled)
- `QUERY_CACHE_MAX_SIZE` - Maximum in-memory cache size (default: 1000)

### Cache TTLs

Cache TTLs are configured in `lib/cache/cacheKeys.ts`:
- Organization context: 5 minutes
- Role permissions: 10 minutes
- Project phases: 2 minutes
- Project members: 1 minute

## Troubleshooting

### Redis Connection Issues

If Redis is not available, the system automatically falls back to in-memory caching. Check logs for Redis connection errors.

### Cache Not Working

1. Verify `ENABLE_QUERY_CACHE` is not set to 'false'
2. Check that cache keys are being generated correctly
3. Verify data is being set in cache (check logs)

### Performance Not Improving

1. Verify database indexes are created (run migration)
2. Check cache hit rates (should be >80%)
3. Monitor API response times
4. Check for slow queries using analysis script

## Rollback

To disable optimizations:

1. **Disable Redis**: Set `ENABLE_REDIS_CACHE=false`
2. **Disable All Caching**: Set `ENABLE_QUERY_CACHE=false`
3. **Remove Indexes**: Drop indexes using SQL (see migration file)

All optimizations are backward compatible and can be disabled without breaking functionality.

