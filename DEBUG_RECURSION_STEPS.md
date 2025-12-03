# Debug Steps for Users Table Recursion

## Current Issue
Even after running migrations, still getting:
```
Stack Depth Limit exceeded
infinite recursion detected in policy for relation "users"
```

## Diagnostic Steps

### Step 1: Check Current Policy State
Run this in Supabase SQL Editor:
```sql
SELECT 
  policyname,
  cmd as command_type,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY policyname;
```

**What to look for:**
- Policy 2 should use `user_organization_id()` function
- Policy 2 should NOT have `SELECT organization_id FROM users` in it

### Step 2: Check Function
Run this:
```sql
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'user_organization_id';
```

**What to look for:**
- Function should exist
- Function definition should include `SECURITY DEFINER`
- Function should query `users` table

### Step 3: Run Complete Fix
Run the migration: `migrations/VERIFY_AND_FIX_USERS_RECURSION.sql`

This will:
1. ✅ Drop and recreate function with SECURITY DEFINER
2. ✅ Drop ALL existing policies
3. ✅ Create policies correctly (Policy 2 uses function)

### Step 4: Test
After running the fix, test:

1. **Test function:**
   ```sql
   SELECT user_organization_id();
   ```
   Should return your organization_id (or NULL if not set)

2. **Test reading own record:**
   ```sql
   SELECT * FROM users WHERE auth_id = auth.uid();
   ```
   Should work without recursion

3. **Test reading org users:**
   ```sql
   SELECT * FROM users WHERE organization_id = user_organization_id();
   ```
   Should work without recursion

4. **Test in app:**
   - Go to project settings page
   - Should load without "Stack Depth Limit exceeded" error

## Common Issues

### Issue 1: Policy 2 Still Uses Direct Query
**Symptom:** Policy 2 has `SELECT organization_id FROM users` in it

**Fix:** Policy 2 MUST use `user_organization_id()` function, not direct query

### Issue 2: Function Doesn't Have SECURITY DEFINER
**Symptom:** Function exists but doesn't bypass RLS

**Fix:** Recreate function with `SECURITY DEFINER` clause

### Issue 3: Multiple Policies Conflict
**Symptom:** Multiple policies on users table causing conflicts

**Fix:** Drop all policies and recreate them in correct order

## Why This Happens

When Policy 2 uses a direct query like:
```sql
organization_id = (SELECT organization_id FROM users WHERE auth_id = auth.uid())
```

PostgreSQL evaluates:
1. Policy 2 needs to check if subquery can read from users table
2. This triggers RLS policy evaluation again
3. Policy 2 is evaluated again → infinite loop

**Solution:** Use `user_organization_id()` function which:
- Uses SECURITY DEFINER → runs as postgres user
- Bypasses RLS completely → no policy evaluation
- Breaks recursion cycle

