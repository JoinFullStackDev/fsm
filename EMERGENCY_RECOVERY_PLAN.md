# Emergency Database Recovery Plan

## Current Situation
- Database is completely locked due to RLS policy recursion
- All connections are stuck
- Cannot access Supabase dashboard
- Cannot run SQL queries
- Cannot restore backups

## Immediate Actions Required

### Step 1: Contact Supabase Support (URGENT)
1. Go to: https://supabase.com/support
2. Create a **URGENT** support ticket
3. Title: "Database Locked - RLS Recursion - Need Connections Killed"
4. Include the content from `SUPABASE_SUPPORT_REQUEST.md`
5. Request they:
   - Kill all active database connections
   - Allow you to disable RLS on `users` table
   - Or run the fix command for you

### Step 2: Alternative - Wait for Timeout
- Connections may timeout after 5-30 minutes
- Once timed out, immediately run: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;`
- This must be done BEFORE any other queries run

### Step 3: After Access is Restored
Once you can run SQL again, execute in this order:

1. **First**: `migrations/MINIMAL_FIX_USERS_ONLY.sql`
   - Just disables RLS on users table
   - This breaks the recursion loop

2. **Second**: `migrations/EMERGENCY_FIX_STEP_BY_STEP.sql`
   - Recreates users table policies properly
   - Uses simple queries to avoid recursion

3. **Third**: `migrations/COMPREHENSIVE_RLS_FIX.sql`
   - Fixes all other table policies
   - Ensures everything works together

## What Went Wrong

The migrations we ran (`fix_rls_recursion_proper.sql`, `add_missing_rls_policies.sql`) created policies that query the `users` table. However, the `users` table policies were broken/missing, causing:

```
Policy on projects → queries users table → blocked by RLS → 
tries to evaluate users policy → queries users table → 
blocked by RLS → infinite loop
```

## Prevention for Future

Before running RLS migrations:
1. Always ensure `users` table has working policies FIRST
2. Test policies don't cause recursion
3. Use `LIMIT 1` in subqueries
4. Test in staging first

## Files to Share with Support

- `SUPABASE_SUPPORT_REQUEST.md` - Support ticket content
- `migrations/MINIMAL_FIX_USERS_ONLY.sql` - The fix command
- This file - Recovery plan

## Timeline

- **Now**: Database locked, need support intervention
- **After support kills connections**: Run minimal fix (30 seconds)
- **After minimal fix**: Run step-by-step fix (2-3 minutes)
- **After step-by-step**: Run comprehensive fix (5-10 minutes)
- **Total recovery time**: ~15-20 minutes after support intervention

