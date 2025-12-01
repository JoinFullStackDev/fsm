# Query Performance Monitoring Guide

## Overview

This guide provides instructions for monitoring query performance in Supabase and identifying optimization opportunities.

## Monitoring Queries

### Weekly Monitoring Checklist

1. **Run slow query report** (`scripts/monitor-slow-queries.sql`)
   - Identify queries taking > 10ms on average
   - Review queries consuming the most total time
   - Check for new slow queries

2. **Check index usage**
   - Identify unused indexes (can be dropped to save space)
   - Verify new indexes are being used
   - Monitor index sizes

3. **Monitor cache hit rates**
   - Table cache hit rate should be > 95%
   - Index cache hit rate should be > 95%
   - Low cache hit rates indicate need for more memory or query optimization

4. **Review query trends**
   - Compare mean_time over time
   - Identify queries getting slower
   - Track improvements from optimizations

## Key Metrics

### Cache Hit Rate
- **Target**: > 95%
- **Action if low**: Increase database memory or optimize queries

### Mean Query Time
- **Target**: < 10ms for most queries
- **Action if high**: Add indexes, optimize query patterns, implement caching

### Index Usage
- **Target**: All frequently used columns should have indexes
- **Action if unused**: Review and potentially drop unused indexes

## Optimization Strategies

### When to Add Indexes
- Columns used in WHERE clauses frequently
- Columns used in JOIN conditions
- Columns used in ORDER BY clauses
- Composite indexes for multiple column filters

### When to Use Caching
- Frequently accessed data that changes infrequently
- Expensive queries that are called repeatedly
- Data that can tolerate slight staleness (30 seconds to 5 minutes)

### When to Optimize Query Patterns
- N+1 query patterns (fetching related data in loops)
- Queries that fetch more data than needed
- Queries that can be combined into single queries

## Alerting Thresholds

Set up alerts for:
- Mean query time > 50ms
- Cache hit rate < 90%
- New queries appearing in slow query report
- Index usage dropping significantly

## Best Practices

1. **Monitor regularly**: Run monitoring queries weekly
2. **Track trends**: Compare results over time
3. **Document changes**: Note when indexes or queries are added/modified
4. **Test in staging**: Always test optimizations in staging first
5. **Measure impact**: Compare before/after metrics

## Related Files

- `scripts/monitor-slow-queries.sql` - Monitoring queries
- `migrations/add_*_indexes.sql` - Index creation migrations
- `lib/cache/queryCache.ts` - Application-level caching
- `lib/dashboards/widgetData/*.ts` - Optimized query functions
