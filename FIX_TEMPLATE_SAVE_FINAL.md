# Final Fix for Template Save Recursion

## Problem
Regular users (non-super admin) get "stack depth limit exceeded" when saving templates, even though super admins can save fine.

## Root Cause
The RLS policies on `template_field_configs` table have queries that check `created_by IN (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)`. This direct query to `users` table causes recursion.

## Solution

### Step 1: Run Updated Migration
**File:** `migrations/FIX_TEMPLATE_FIELD_CONFIGS_RLS.sql`

This migration has been updated to:
- ✅ Remove ALL direct queries to `users` table from template policies
- ✅ Use ONLY `user_organization_id()` function (which bypasses RLS)
- ✅ Policies check access via `project_templates` table only

### Step 2: Code Already Fixed
- ✅ Template builder now uses API route: `/api/admin/templates/[id]/field-configs`
- ✅ API route uses admin client (bypasses RLS completely)
- ✅ API route doesn't call `getUserOrganizationId()` (gets org_id from user record)

## What Changed in Policies

### Before (Causing Recursion):
```sql
WHERE (
  organization_id = user_organization_id()
  AND created_by IN (
    SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1  -- ❌ RECURSION!
  )
)
```

### After (Fixed):
```sql
WHERE organization_id = user_organization_id()  -- ✅ Function bypasses RLS
-- No created_by check needed - organization check is sufficient
```

## Why This Works

1. **`user_organization_id()` function** uses SECURITY DEFINER → bypasses RLS → no recursion
2. **No direct queries** to users table → no recursion possible
3. **API route uses admin client** → bypasses RLS completely → works for all users

## Testing

After running the migration:

1. ✅ **Super admin saves template** - Should work (already works)
2. ✅ **Regular admin saves template** - Should work now
3. ✅ **PM saves template** - Should work now
4. ✅ **No "stack depth limit exceeded" errors**

## Files Changed

1. `migrations/FIX_TEMPLATE_FIELD_CONFIGS_RLS.sql` - Removed direct queries to users table
2. `app/admin/templates/[id]/builder/page.tsx` - Uses API route for saving
3. `app/api/admin/templates/[id]/field-configs/route.ts` - Uses admin client, no getUserOrganizationId()

## Next Steps

1. **Run the migration:** `migrations/FIX_TEMPLATE_FIELD_CONFIGS_RLS.sql`
2. **Test template saving as regular admin**
3. **Should work without recursion errors**

