# URGENT: Run RLS Fix Migration

## Problem
Your app is experiencing "stack depth limit exceeded" errors due to RLS recursion. This is blocking:
- Package features loading
- Templates access
- Dashboards access
- Ops tools access
- Notifications

## Solution
Run the `FIX_ALL_RLS_ISSUES.sql` migration in Supabase SQL Editor.

## Steps

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Run the Migration**
   - Open the file: `migrations/FIX_ALL_RLS_ISSUES.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify It Worked**
   - Check for any errors in the SQL Editor output
   - Refresh your app
   - Check the browser console - the "stack depth limit exceeded" errors should be gone

## What This Migration Does

1. **Fixes `user_organization_id()` RPC function** - Makes it non-recursive using SECURITY DEFINER
2. **Fixes Users table policies** - Uses RPC function instead of direct queries
3. **Fixes Organizations table** - Uses RPC function for organization checks
4. **Fixes Subscriptions table** - Uses RPC function to avoid recursion
5. **Fixes Packages table** - Simple auth check (no recursion needed)
6. **Fixes Projects table** - Uses RPC function
7. **Fixes all other tables** - Project phases, tasks, dashboards, companies, opportunities, contacts, templates

## Important Notes

- This migration is **idempotent** - you can run it multiple times safely
- It uses `DROP POLICY IF EXISTS` to avoid conflicts
- All policies use the `user_organization_id()` RPC function which bypasses RLS recursion

## After Running

Once the migration completes successfully:
- Refresh your browser
- You should see package features load correctly
- Templates, dashboards, and ops tools should work
- No more "stack depth limit exceeded" errors

