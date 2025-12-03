# URGENT: Fix Users Table Recursion

## Problem
Even after running `FIX_NEW_USER_RLS_RECURSION.sql`, you're still getting:
```
Failed to load template phases: infinite recursion detected in policy for relation "users"
```

## Root Cause
The users table Policy 2 was changed to use a direct query:
```sql
organization_id = (SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
```

This **still causes recursion** because:
- When PostgreSQL evaluates Policy 2, it needs to check if the subquery can read from `users` table
- This triggers RLS policy evaluation again → infinite loop

## Solution
Policy 2 **MUST** use `user_organization_id()` function, NOT a direct query.

The function uses `SECURITY DEFINER`, which means:
- It runs with postgres privileges
- It **bypasses RLS completely**
- No recursion because RLS policies aren't evaluated

## Migration to Run

**File:** `migrations/FIX_USERS_TABLE_RECURSION_FINAL.sql`

This migration:
1. ✅ Ensures `user_organization_id()` function exists with SECURITY DEFINER
2. ✅ Fixes Policy 2 to use the function instead of direct query
3. ✅ Breaks the recursion cycle

## Why This Works

- **Policy 1**: `auth.uid() = auth_id` - No function calls, no recursion
- **Policy 2**: Uses `user_organization_id()` function
  - Function uses SECURITY DEFINER → bypasses RLS
  - Function queries users table → no RLS policies evaluated
  - No recursion!

## Steps

1. **Run the migration immediately:**
   ```sql
   -- Copy contents of migrations/FIX_USERS_TABLE_RECURSION_FINAL.sql
   -- Paste into Supabase SQL Editor
   -- Run it
   ```

2. **Test:**
   - Try loading template phases
   - Try creating a project
   - Try creating a template
   - Should work without recursion errors

## Important Note

The previous migration (`FIX_NEW_USER_RLS_RECURSION.sql`) had the wrong approach for Policy 2. The direct query approach still causes recursion. **You MUST use the function** to break the recursion cycle.

