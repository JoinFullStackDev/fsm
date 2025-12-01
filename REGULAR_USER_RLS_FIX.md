# Fix RLS Policies for Regular Company Admins

## Problem

Regular company admins cannot access:
- Their organization's package features (ops_tool_enabled, custom_dashboards_enabled, etc.)
- Their organization's module_overrides

Super admins can access everything fine because they use admin client.

## Root Cause

The RLS policies were creating a circular dependency:

1. **Users table policy** checked `organization_id = user_organization_id()`
2. **`user_organization_id()` function** queries the `users` table to get `organization_id`
3. **Circular dependency**: Policy needs function → Function needs to read users table → Policy blocks reading users table

## Solution

Split the users table policy into **two separate policies**:

1. **Policy 1**: "Users can read own user record"
   - Simple check: `auth.uid() = auth_id`
   - Allows users to read their own record
   - **Required** for `user_organization_id()` function to work

2. **Policy 2**: "Users can view users in their organization"
   - Checks: `auth.uid() = auth_id OR organization_id = user_organization_id()`
   - Allows reading other users in the same organization
   - Now works because Policy 1 allows reading own record first

## How It Works Now

1. **User logs in** → Can read own user record (Policy 1)
2. **`user_organization_id()` function** → Can read user's own record (SECURITY DEFINER bypasses RLS, but Policy 1 also allows it)
3. **Function returns** → User's `organization_id`
4. **Other policies** → Can use `user_organization_id()` to check access:
   - Organizations: `id = user_organization_id()` ✅
   - Subscriptions: `organization_id = user_organization_id()` ✅
   - Projects: `organization_id = user_organization_id()` ✅

## Updated Migration

The `FIX_ALL_RLS_ISSUES.sql` migration has been updated with:

```sql
-- Policy 1: Users can read their own record (required for user_organization_id() to work)
CREATE POLICY "Users can read own user record"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

-- Policy 2: Users can read other users in their organization
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    auth.uid() = auth_id
    OR
    organization_id = user_organization_id()
  );
```

## Testing

After running the migration, regular company admins should be able to:

1. ✅ Access ops tool (if package has `ops_tool_enabled: true`)
2. ✅ Access dashboards (if package has `custom_dashboards_enabled: true`)
3. ✅ Access knowledge base (if package has `knowledge_base_enabled: true`)
4. ✅ See module overrides applied correctly
5. ✅ See package features loaded correctly

## Verification Queries

Run these as a regular user in Supabase SQL Editor to verify:

```sql
-- 1. Test user_organization_id() function
SELECT user_organization_id();

-- 2. Test reading own organization (for module_overrides)
SELECT id, name, module_overrides 
FROM organizations 
WHERE id = user_organization_id();

-- 3. Test reading own subscription (to get package_id)
SELECT id, package_id, status 
FROM subscriptions 
WHERE organization_id = user_organization_id();

-- 4. Test reading packages (to get features)
SELECT id, name, features->>'ops_tool_enabled' as ops_tool 
FROM packages 
LIMIT 5;
```

All queries should return data without errors.

## Next Steps

1. **Run Migration**: Execute `migrations/FIX_ALL_RLS_ISSUES.sql` in Supabase SQL Editor
2. **Test**: Log in as a regular company admin and verify:
   - Package features load correctly
   - Module overrides work correctly
   - Ops tool, dashboards, knowledge base are accessible (if enabled in package)

