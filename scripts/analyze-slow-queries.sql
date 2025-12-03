-- Query analysis script for performance monitoring
-- Run this periodically to identify slow queries and missing indexes

-- Find slow queries (queries taking more than 100ms on average)
SELECT 
  query,
  calls,
  mean_time,
  total_time,
  rows_read,
  cache_hit_rate,
  prop_total_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Find queries with low cache hit rates
SELECT 
  query,
  calls,
  mean_time,
  cache_hit_rate,
  rows_read
FROM pg_stat_statements
WHERE cache_hit_rate < 90
ORDER BY calls DESC
LIMIT 20;

-- Find most frequently called queries
SELECT 
  query,
  calls,
  mean_time,
  total_time,
  prop_total_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Find queries consuming the most total time
SELECT 
  query,
  calls,
  mean_time,
  total_time,
  prop_total_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;

-- Check index usage for specific tables
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Find unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY tablename;

-- Check table sizes and bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

