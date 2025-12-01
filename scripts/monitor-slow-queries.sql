-- Query Performance Monitoring Scripts
-- Run these queries in Supabase SQL Editor to monitor query performance
--
-- Usage: Run weekly to track query performance and identify new slow queries

-- 1. Identify slow queries (queries taking > 10ms on average)
SELECT 
  query,
  rolname,
  calls,
  mean_time,
  min_time,
  max_time,
  total_time,
  rows_read,
  cache_hit_rate,
  prop_total_time
FROM pg_stat_statements
WHERE mean_time > 10  -- queries taking > 10ms on average
ORDER BY total_time DESC
LIMIT 50;

-- 2. Index usage statistics (identify unused indexes)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- unused indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Table access statistics (identify frequently accessed tables)
SELECT 
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY seq_scan + idx_scan DESC
LIMIT 20;

-- 4. Cache hit rates (should be > 95% for good performance)
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;

-- 5. Index hit rates (should be > 95% for good performance)
SELECT 
  sum(idx_blks_read) as idx_read,
  sum(idx_blks_hit) as idx_hit,
  sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)) as idx_cache_hit_ratio
FROM pg_statio_user_indexes;

-- 6. Query performance trends (compare mean_time over time)
-- Note: This requires pg_stat_statements extension and historical data
-- Run this query periodically and compare results

-- 7. Identify queries with low cache hit rates
SELECT 
  query,
  calls,
  mean_time,
  cache_hit_rate,
  prop_total_time
FROM pg_stat_statements
WHERE cache_hit_rate < 0.95  -- less than 95% cache hit rate
  AND calls > 100  -- only queries called frequently
ORDER BY prop_total_time DESC
LIMIT 20;
