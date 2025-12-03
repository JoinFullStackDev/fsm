# Fix: Stack Depth Limit Exceeded for New Users

## Problem
When new users create their account and try to add projects, save templates, or perform other actions, they get "stack depth limit exceeded" errors for almost every second-layer action.

## Root Cause
The RLS (Row Level Security) policies are causing infinite recursion:

1. **Users table Policy 2** uses `user_organization_id()` function
2. **`user_organization_id()` function** queries the `users` table
3. **Other policies** (projects, templates, etc.) also use `user_organization_id()`
4. When a new user tries to create something, the policy evaluation triggers:
   - Policy checks `organization_id = user_organization_id()`
   - Function queries `users` table
   - `users` table policy calls `user_organization_id()` again
   - **Infinite recursion** → Stack depth exceeded

## Solution
The fix involves two key changes:

1. **Fix Users Table Policy 2**: Replace `user_organization_id()` with a direct query that Policy 1 allows
2. **Add Fallbacks**: All other policies should have fallbacks to direct queries if `user_organization_id()` returns NULL

## Migration File
Run this migration in your Supabase SQL Editor:

**File:** `migrations/FIX_NEW_USER_RLS_RECURSION.sql`

## What the Migration Does

### Step 1: Fix `user_organization_id()` Function
- Ensures function uses `SECURITY DEFINER` properly
- Handles NULL cases gracefully

### Step 2: Fix Users Table Policies (CRITICAL)
- **Policy 1**: Users can read own record (no function calls)
- **Policy 2**: Changed from `user_organization_id()` to direct query
  - Uses: `organization_id = (SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1)`
  - Policy 1 allows reading own record, so this subquery works
  - **This breaks the recursion cycle**

### Step 3-6: Fix Other Table Policies
- Projects, Templates, Organizations, Subscriptions
- All policies now have fallbacks to direct queries
- If `user_organization_id()` returns NULL, fallback query works

## How to Apply

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Run the Migration**
   - Open: `migrations/FIX_NEW_USER_RLS_RECURSION.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify It Worked**
   - Check for any errors in SQL Editor output
   - Test with a new user account:
     - Create account
     - Create a project
     - Create a template
   - Should work without "stack depth limit exceeded" errors

## Why This Works

The key insight is that **Policy 1 on users table allows reading own record without any function calls**. This means:

1. User can read their own record (Policy 1)
2. Policy 2's subquery can read user's own record (allowed by Policy 1)
3. No recursion because Policy 2 doesn't call `user_organization_id()`
4. Other policies can use `user_organization_id()` safely because it queries users table with SECURITY DEFINER (bypasses RLS)

## Comprehensive Coverage

This fix covers **ALL** tables and operations that could cause recursion:

### Tables Fixed ✅
1. ✅ `users` - Fixed Policy 2 (breaks recursion cycle)
2. ✅ `projects` - All operations (SELECT, INSERT, UPDATE, DELETE)
3. ✅ `project_templates` - All operations
4. ✅ `project_phases` - All operations
5. ✅ `project_tasks` - All operations
6. ✅ `project_members` - All operations
7. ✅ `companies` - All operations
8. ✅ `opportunities` - All operations
9. ✅ `company_contacts` - All operations
10. ✅ `dashboards` - All operations
11. ✅ `dashboard_widgets` - All operations
12. ✅ `organizations` - SELECT policy
13. ✅ `subscriptions` - SELECT policy

### Operations Covered ✅
- ✅ **CREATE** (INSERT) - Creating projects, templates, phases, tasks, companies, opportunities, contacts, dashboards
- ✅ **READ** (SELECT) - Viewing all resources
- ✅ **UPDATE** - Editing all resources
- ✅ **DELETE** - Deleting all resources

## Testing Checklist

After running the migration, test:

- [ ] New user can create account
- [ ] New user can create a project
- [ ] New user can create a template
- [ ] New user can create/edit project phases
- [ ] New user can create/edit project tasks
- [ ] New user can create/edit companies
- [ ] New user can create/edit opportunities
- [ ] New user can create/edit contacts
- [ ] New user can create/edit dashboards
- [ ] New user can view their organization
- [ ] Existing users continue to work normally
- [ ] No "stack depth limit exceeded" errors in browser console

## Notes

- This migration is **idempotent** - safe to run multiple times
- Uses `DROP POLICY IF EXISTS` to avoid conflicts
- All policies use `LIMIT 1` in subqueries to prevent errors
- Fallbacks ensure policies work even if `user_organization_id()` returns NULL

