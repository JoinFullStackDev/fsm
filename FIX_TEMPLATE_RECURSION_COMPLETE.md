# Complete Fix for Template Recursion Issues

## Root Cause

The recursion is happening because:

1. **Template policies have fallback queries** that directly query `users` table:
   ```sql
   organization_id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
   ```

2. **`getUserOrganizationId()` fallback** also queries `users` table directly

3. When creating/saving templates:
   - Template INSERT policy evaluates
   - Falls back to querying `users` table
   - `users` table RLS policy evaluates
   - Might query templates or call functions that query users
   - **Infinite recursion**

## Solution

### Step 1: Run Template RLS Fix Migration

**File:** `migrations/FIX_TEMPLATE_RLS_RECURSION.sql`

This migration:
- ✅ Removes ALL direct queries to `users` table from template policies
- ✅ Uses ONLY `user_organization_id()` function (which bypasses RLS)
- ✅ Keeps `created_by` check (this is safe - queries own record via Policy 1)

### Step 2: Code Fix Applied

**File:** `lib/organizationContext.ts`

Changed `getUserOrganizationId()` fallback to use admin client instead of direct query:
- ✅ Admin client bypasses RLS
- ✅ No recursion possible

## What Changed

### Before (Causing Recursion):
```sql
-- Template INSERT policy
WITH CHECK (
  (
    organization_id = user_organization_id()
    OR
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1  -- ❌ RECURSION!
    )
  )
  AND created_by IN (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
)
```

### After (Fixed):
```sql
-- Template INSERT policy
WITH CHECK (
  organization_id = user_organization_id()  -- ✅ Function bypasses RLS
  AND created_by IN (
    SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1  -- ✅ Safe - Policy 1 allows own record
  )
)
```

## Why This Works

1. **`user_organization_id()` function** uses `SECURITY DEFINER` → bypasses RLS → no recursion
2. **`created_by` check** queries own user record → Policy 1 allows it → no recursion
3. **No fallback queries** to users table → no recursion possible

## Testing

After running the migration:

1. ✅ **Create template** - Should work
2. ✅ **Save generated template** - Should work  
3. ✅ **Create project with template** - Should work
4. ✅ **No "Stack Depth Limit exceeded" errors**

## Files Changed

1. `migrations/FIX_TEMPLATE_RLS_RECURSION.sql` - New migration
2. `lib/organizationContext.ts` - Fixed fallback to use admin client

## Next Steps

1. **Run the migration:** `migrations/FIX_TEMPLATE_RLS_RECURSION.sql`
2. **Test template creation/saving**
3. **Test project creation with template**
4. **Should all work without recursion errors**

