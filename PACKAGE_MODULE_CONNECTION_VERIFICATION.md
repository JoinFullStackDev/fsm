# Package-to-Module Connection Verification

## Problem

The ops tool (and other modules) are part of packages that clients purchased, but they're not accessible because:

1. **RLS Recursion**: The `getOrganizationPackageFeatures()` function queries `subscriptions` and `packages` tables, which are hitting RLS recursion errors because the `FIX_ALL_RLS_ISSUES.sql` migration hasn't been run yet.

2. **Package Features Flow**:
   - Ops tool route → `hasOpsTool()` → `hasFeatureAccess()` → `getOrganizationPackageFeatures()`
   - This queries `subscriptions` table (RLS recursion) → queries `packages` table (RLS recursion)
   - Returns `null` → `hasFeatureAccess()` returns `false` → "Ops Tool is not available"

## Solution

### Step 1: Run RLS Migration (CRITICAL)

**You MUST run `migrations/FIX_ALL_RLS_ISSUES.sql` first!**

This migration fixes:
- `subscriptions` table RLS policies (uses `user_organization_id()` RPC)
- `packages` table RLS policies (simple auth check)
- All other tables that cause recursion

**Without this migration, package features cannot be loaded.**

### Step 2: Verify Package Features

After running the migration, verify that packages have correct module features:

1. Go to `/global/admin/packages`
2. Check each package's features:
   - `ops_tool_enabled`: Should be `true` for packages that include ops tool
   - `custom_dashboards_enabled`: Should be `true` for packages that include dashboards
   - `knowledge_base_enabled`: Should be `true` for packages that include knowledge base
   - `ai_features_enabled`: Should be `true` for packages that include AI features
   - `analytics_enabled`: Should be `true` for packages that include analytics
   - `api_access_enabled`: Should be `true` for packages that include API access
   - `export_features_enabled`: Should be `true` for packages that include export features

### Step 3: Verify Module Mapping

All modules are properly mapped:

| Module Key | Module Name | Package Feature Key |
|------------|-------------|---------------------|
| `ops_tool_enabled` | Ops Tool | `ops_tool_enabled` ✅ |
| `custom_dashboards_enabled` | Custom Dashboards | `custom_dashboards_enabled` ✅ |
| `knowledge_base_enabled` | Knowledge Base | `knowledge_base_enabled` ✅ |
| `ai_features_enabled` | AI Features | `ai_features_enabled` ✅ |
| `ai_task_generator_enabled` | AI Task Generator | `ai_task_generator_enabled` ✅ |
| `analytics_enabled` | Analytics | `analytics_enabled` ✅ |
| `api_access_enabled` | API Access | `api_access_enabled` ✅ |
| `export_features_enabled` | Export Features | `export_features_enabled` ✅ |

**All modules are correctly mapped!** ✅

## How It Works

1. **Package Features**: Stored in `packages.features` JSONB column
   ```json
   {
     "ops_tool_enabled": true,
     "custom_dashboards_enabled": true,
     "knowledge_base_enabled": true,
     ...
   }
   ```

2. **Organization Subscription**: Links to a package via `subscriptions.package_id`

3. **Feature Access Check**:
   - `hasFeatureAccess()` checks `organizations.module_overrides` first (if exists)
   - Falls back to `packages.features` from the organization's subscription
   - Returns `true` if feature is enabled, `false` otherwise

4. **Module Overrides**: Can override package features per organization
   - Stored in `organizations.module_overrides` JSONB
   - Takes precedence over package features
   - Used for custom enable/disable per organization

## Testing After Migration

1. **Run the RLS migration**: `migrations/FIX_ALL_RLS_ISSUES.sql`
2. **Refresh browser**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
3. **Check ops tool**: Should work if package has `ops_tool_enabled: true`
4. **Check dashboards**: Should work if package has `custom_dashboards_enabled: true`
5. **Check knowledge base**: Should work if package has `knowledge_base_enabled: true`

## Verification Script

Run `scripts/verify-package-modules.ts` to verify all packages have correct module features configured.

## Summary

✅ **Module mapping is correct** - All modules are properly mapped to package features  
✅ **Code is correct** - Feature access checks work correctly  
❌ **RLS migration not run** - This is blocking package feature loading  
⚠️ **Need to verify** - After migration, verify packages have correct features enabled

**Action Required**: Run `migrations/FIX_ALL_RLS_ISSUES.sql` migration in Supabase SQL Editor.

