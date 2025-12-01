# Query Optimization Guide

## Overview

This guide provides best practices for optimizing database queries in the FSM application.

## Index Strategy

### When to Create Indexes

1. **Frequently filtered columns**
   - Columns used in WHERE clauses
   - Example: `project_id`, `user_id`, `status`

2. **Join columns**
   - Foreign keys used in JOINs
   - Example: `project_tasks.project_id`, `project_members.user_id`

3. **Composite indexes**
   - Multiple columns filtered together
   - Example: `(project_id, assignee_id, status, due_date)`

4. **Partial indexes**
   - Indexes with WHERE clauses for common filters
   - Example: `WHERE due_date IS NOT NULL`

### Index Best Practices

- **Don't over-index**: Too many indexes slow down writes
- **Monitor usage**: Drop unused indexes
- **Use partial indexes**: For columns with many NULL values
- **Consider order**: Put most selective columns first in composite indexes

## Query Pattern Optimization

### Eliminate N+1 Queries

**Bad:**
```typescript
// Fetch projects
const projects = await supabase.from('projects').select('id');
// Then fetch tasks for each project (N+1)
for (const project of projects) {
  const tasks = await supabase.from('project_tasks').eq('project_id', project.id);
}
```

**Good:**
```typescript
// Single query with IN clause
const projectIds = projects.map(p => p.id);
const tasks = await supabase.from('project_tasks').in('project_id', projectIds);
```

### Use Database Functions

For complex queries, use database functions to:
- Perform JOINs at database level
- Reduce round trips
- Leverage database query optimizer

Example: `count_filtered_tasks()` function eliminates N+1 pattern.

## Caching Strategy

### Application-Level Caching

Use `queryCache` for:
- Frequently accessed data
- Expensive queries
- Data that changes infrequently

**TTL Guidelines:**
- Task counts: 30 seconds
- Project IDs: 5 minutes
- Organization context: 30 seconds
- Widget data: 1 minute

### Cache Invalidation

Invalidate cache when:
- Data is created/updated/deleted
- Related data changes
- User permissions change

Example:
```typescript
// After creating a task
queryCache.invalidate('task_count');
queryCache.invalidate('tasks_due_today');
```

## Materialized Views

Use materialized views for:
- Expensive queries run frequently
- Data that changes infrequently
- Complex aggregations

Example: `user_project_mappings` materialized view caches user-project relationships.

**Refresh Strategy:**
- Refresh periodically (every 5 minutes)
- Refresh on-demand when data changes
- Use CONCURRENTLY to avoid locking

## Realtime Optimization

### Best Practices

1. **Filter precisely**: Use specific filters instead of broad subscriptions
   ```typescript
   // Good: Filter by user_id
   filter: `user_id=eq.${userId}`
   
   // Bad: Subscribe to all notifications
   filter: '*'
   ```

2. **Unsubscribe properly**: Always cleanup subscriptions
   ```typescript
   useEffect(() => {
     const channel = supabase.channel('...').subscribe();
     return () => channel.unsubscribe();
   }, []);
   ```

3. **Subscribe only when needed**: Don't subscribe if component is hidden
   ```typescript
   useEffect(() => {
     if (isVisible) {
       setupSubscription();
     }
     return () => unsubscribe();
   }, [isVisible]);
   ```

## Monitoring

### Key Metrics

1. **Query execution time**: Should be < 10ms for most queries
2. **Cache hit rate**: Should be > 95%
3. **Index usage**: All indexes should be used regularly
4. **Slow queries**: Monitor queries taking > 10ms

### Monitoring Tools

- Supabase Dashboard: Query performance metrics
- `scripts/monitor-slow-queries.sql`: Custom monitoring queries
- Application logs: Query errors and warnings

## Rollback Procedures

### Disable Caching

Set environment variable:
```bash
ENABLE_QUERY_CACHE=false
```

### Drop Indexes

All index migrations include rollback SQL:
```sql
-- Uncomment to rollback
DROP INDEX IF EXISTS idx_name;
```

### Revert Query Changes

All query optimizations include fallback to original implementation. Functions gracefully degrade if optimizations fail.

## Testing

### Before Deploying Optimizations

1. **Test in staging**: Always test in staging environment first
2. **Compare results**: Verify optimized queries return same results
3. **Measure performance**: Compare query times before/after
4. **Test edge cases**: Empty results, null values, etc.

### Verification Checklist

- [ ] Query results match original implementation
- [ ] Query performance improved
- [ ] No new errors in logs
- [ ] Cache invalidation works correctly
- [ ] Indexes are being used (check EXPLAIN ANALYZE)

## Related Documentation

- `docs/QUERY_PERFORMANCE_MONITORING.md` - Monitoring guide
- `PERFORMANCE_OPTIMIZATIONS.md` - Previous optimizations
- `migrations/` - Database migrations
