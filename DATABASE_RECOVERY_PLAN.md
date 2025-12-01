# Database Recovery Plan

## After Database Restart

Your database has been restarted. Here's the **simple, safe recovery plan**:

---

## ✅ Step 1: Run ONE Migration (That's It!)

**Run `migrations/FIX_ALL_RLS_ISSUES.sql`**

This single migration will:
- ✅ Fix the `user_organization_id()` function
- ✅ Fix all RLS policies (users, organizations, subscriptions, packages, projects, etc.)
- ✅ Allow public access to packages (for pricing pages)
- ✅ Use direct queries for subscriptions (no function call issues)
- ✅ Include fallbacks for organizations and subscriptions
- ✅ **Safe to run multiple times** (idempotent)

**That's all you need to do.**

---

## What This Migration Does (Safe Operations Only)

✅ **Safe operations:**
- `DROP FUNCTION IF EXISTS` - Only drops if exists, won't break anything
- `DROP POLICY IF EXISTS` - Only drops if exists, won't break anything
- `CREATE FUNCTION` - Creates/updates function safely
- `CREATE POLICY` - Creates/updates policies safely
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` - Just enables RLS, doesn't delete data
- `GRANT` statements - Just adds permissions, doesn't remove data

❌ **What it DOESN'T do:**
- No `DROP TABLE` - Won't delete tables
- No `TRUNCATE` - Won't delete data
- No `DELETE` - Won't delete rows
- No `DROP CASCADE` on tables - Won't break dependencies
- No destructive operations

---

## After Running Migration

1. **Restart your Next.js dev server** (important!)
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear browser cache** (or use incognito mode)

3. **Test these pages:**
   - ✅ `/` (landing page) - Should show packages
   - ✅ `/pricing` - Should show packages
   - ✅ Login as regular user - Should work
   - ✅ `/projects` - Should show projects
   - ✅ `/ops/companies` - Should work if package includes ops tool

---

## If Something Goes Wrong

### Option 1: Run Migration Again
The migration is idempotent - you can run it multiple times safely.

### Option 2: Check Specific Tables
If a specific table has issues, you can temporarily disable RLS:
```sql
ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;
```
But this should NOT be necessary - the migration should fix everything.

### Option 3: Emergency Disable All RLS (Last Resort)
Only if absolutely necessary:
```sql
-- Emergency: Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ... etc
```
**But this should NOT be needed** - the migration should work correctly.

---

## Why This Migration is Safe

1. **Uses `IF EXISTS`** - Won't error if things don't exist
2. **Idempotent** - Can run multiple times with same result
3. **No data deletion** - Only creates/updates policies and functions
4. **No table modifications** - Only enables RLS, doesn't change schema
5. **Defensive fallbacks** - Policies have fallbacks if function fails

---

## Summary

**Just run `migrations/FIX_ALL_RLS_ISSUES.sql` and you're done.**

The database restart actually helps - it clears any stuck connections or locks. Now you can run the migration cleanly.

