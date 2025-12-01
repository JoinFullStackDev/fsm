# RLS Policy Adjustments for Package Features

## Summary

Yes, we need to adjust the RLS policies to ensure package features work correctly. The `FIX_ALL_RLS_ISSUES.sql` migration has been updated to fix potential recursion issues.

## Key Changes Made

### 1. Simplified Super Admin Policies

**Problem**: Super admin policies were querying the `users` table directly, which could cause RLS recursion.

**Solution**: Simplified policies to only allow viewing own organization's data. Super admins should use admin client for cross-org queries (which they already do in the codebase).

**Changed Policies**:
- `subscriptions` table: Removed EXISTS subquery that queried users table
- `organizations` table: Removed EXISTS subquery that queried users table

### 2. Packages Table Policy (Already Correct)

The packages table policy is correct:
```sql
CREATE POLICY "Authenticated users can view packages"
  ON packages FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

This allows all authenticated users to read packages, which is correct since packages aren't sensitive data.

### 3. Subscriptions Table Policy (Already Correct)

The subscriptions table policy uses the RPC function correctly:
```sql
CREATE POLICY "Users can view subscriptions for their organization"
  ON subscriptions FOR SELECT
  USING (organization_id = user_organization_id());
```

This uses `user_organization_id()` RPC function which is `SECURITY DEFINER` and bypasses RLS, preventing recursion.

## How Package Features Work

1. **User queries package features**:
   - `getOrganizationPackageFeatures()` queries `subscriptions` table
   - Uses RLS policy: `organization_id = user_organization_id()`
   - Gets `package_id` from subscription

2. **User queries package**:
   - Queries `packages` table using `package_id`
   - Uses RLS policy: `auth.uid() IS NOT NULL` (all authenticated users can read)
   - Gets `features` JSONB column

3. **Feature access check**:
   - `hasFeatureAccess()` checks `module_overrides` first (if exists)
   - Falls back to `packages.features` from subscription
   - Returns `true` if feature is enabled

## Verification

After running `FIX_ALL_RLS_ISSUES.sql`, verify policies are correct:

1. **Run verification script**: `migrations/VERIFY_RLS_POLICIES.sql`
   - Checks if `user_organization_id()` function exists and is SECURITY DEFINER
   - Lists all policies on `subscriptions` and `packages` tables
   - Tests reading packages and subscriptions

2. **Test package feature loading**:
   - Log in as a user with an active subscription
   - Check browser console for "stack depth limit exceeded" errors
   - Should be gone after migration

3. **Test module access**:
   - Try accessing ops tool, dashboards, knowledge base
   - Should work if package has the feature enabled

## Important Notes

- **Super Admin Access**: Super admins should use `createAdminSupabaseClient()` for cross-org queries (which they already do in the codebase)
- **Regular Users**: Can only access their own organization's data via RLS policies
- **Packages**: All authenticated users can read packages (not sensitive)
- **Subscriptions**: Users can only read subscriptions for their own organization

## Migration Status

✅ **Updated**: `FIX_ALL_RLS_ISSUES.sql` has been updated with simplified policies
✅ **Ready**: Migration is ready to run
⚠️ **Action Required**: Run the migration in Supabase SQL Editor

## Next Steps

1. **Run Migration**: Execute `migrations/FIX_ALL_RLS_ISSUES.sql` in Supabase SQL Editor
2. **Verify**: Run `migrations/VERIFY_RLS_POLICIES.sql` to check policies
3. **Test**: Refresh browser and test module access (ops tool, dashboards, etc.)

