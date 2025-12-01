# Run RLS Migration - Single Script

## ✅ Good News: Only ONE Script Needed!

The `migrations/FIX_ALL_RLS_ISSUES.sql` file is **comprehensive** and includes everything:

- ✅ `fix_user_organization_id_rpc.sql` → Included in STEP 1
- ✅ `fix_rls_recursion_proper.sql` → Included in STEPS 6-8
- ✅ `add_missing_rls_policies.sql` → Included in STEPS 9-15
- ✅ Fix for regular company admins → Included in STEP 2

## How to Run

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**

### Step 2: Run the Migration
1. Open the file: `migrations/FIX_ALL_RLS_ISSUES.sql`
2. Copy the **entire contents** (all 569 lines)
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 3: Verify It Worked
You should see:
- ✅ "Success. No rows returned" (or similar success message)
- ✅ No errors

If you see errors, they might be:
- "policy already exists" → This is OK, the script uses `DROP POLICY IF EXISTS` so it's idempotent
- "function already exists" → This is OK, the script uses `CREATE OR REPLACE FUNCTION`

### Step 4: Test
1. **Refresh your browser** (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
2. **Log in as a regular company admin**
3. **Verify**:
   - ✅ Package features load correctly
   - ✅ Module overrides work
   - ✅ Ops tool accessible (if package has `ops_tool_enabled: true`)
   - ✅ Dashboards accessible (if package has `custom_dashboards_enabled: true`)
   - ✅ Knowledge base accessible (if package has `knowledge_base_enabled: true`)

## What This Migration Does

The migration fixes RLS policies for **15 tables**:

1. **Users** - Fixes circular dependency, allows regular users to read own record
2. **Organizations** - Allows reading own organization (for module_overrides)
3. **Subscriptions** - Allows reading own subscription (to get package_id)
4. **Packages** - Allows all authenticated users to read (to get features)
5. **Projects** - Organization-based access
6. **Project Members** - Organization-based access
7. **Project Phases** - Organization-based access
8. **Project Tasks** - Organization-based access
9. **Dashboards** - Organization-based access (personal + org dashboards)
10. **Dashboard Widgets** - Organization-based access
11. **Companies** - Organization-based access
12. **Opportunities** - Organization-based access
13. **Company Contacts** - Organization-based access
14. **Project Templates** - Organization-based access

## Important Notes

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Non-destructive**: Uses `DROP POLICY IF EXISTS` and `CREATE OR REPLACE`
- ✅ **Comprehensive**: Includes all fixes in one script
- ✅ **Order matters**: Script runs steps in correct order (1-15)

## Troubleshooting

If you see errors:

1. **"policy already exists"** → Ignore, script handles this
2. **"function already exists"** → Ignore, script uses `CREATE OR REPLACE`
3. **"permission denied"** → Make sure you're running as a database admin/superuser
4. **"relation does not exist"** → Table might not exist yet, check your schema

## After Running

Once the migration completes successfully:
- Regular company admins can access their package features
- Module overrides work correctly
- No more "stack depth limit exceeded" errors
- All RLS policies use `user_organization_id()` RPC function (no recursion)

---

**That's it!** Just run the one script and you're done. 🎉

