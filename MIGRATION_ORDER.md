# Migration Order - Simple Guide

## ✅ RECOMMENDED: Run Just ONE Migration

**Run `migrations/FIX_ALL_RLS_ISSUES.sql`** - This is the comprehensive fix that includes:
- ✅ Fixes `user_organization_id()` function
- ✅ Fixes all RLS policies (users, organizations, subscriptions, packages, projects, etc.)
- ✅ Uses direct queries for subscriptions (no function call issues)
- ✅ Includes fallbacks for organizations and subscriptions
- ✅ Idempotent (safe to run multiple times)

**That's it!** You only need to run this one migration.

---

## Alternative: If You Want to Run Separately

If you prefer to run fixes separately (not recommended, but possible):

### Step 1: Fix Function (Optional - Already included in Step 2)
**File**: `migrations/FIX_FUNCTION_PERMISSIONS.sql`
- Fixes `user_organization_id()` function permissions
- Sets owner to postgres
- Grants execute permissions

**Status**: ✅ Optional - `FIX_ALL_RLS_ISSUES.sql` includes this

### Step 2: Fix All RLS Issues (REQUIRED)
**File**: `migrations/FIX_ALL_RLS_ISSUES.sql`
- Drops and recreates `user_organization_id()` function
- Fixes all RLS policies for all tables
- Uses direct queries for subscriptions (no function call)
- Includes fallbacks

**Status**: ✅ **THIS IS THE ONE YOU NEED**

---

## Diagnostic Scripts (Optional - For Troubleshooting)

These are for **testing/diagnosing**, not for fixing:

1. `CHECK_FUNCTION_AND_COLUMN.sql` - Check if function exists and columns are correct
2. `DIAGNOSE_SUBSCRIPTIONS_RLS.sql` - Diagnose subscriptions RLS issues
3. `DIAGNOSE_FUNCTION_NULL.sql` - Diagnose why function returns NULL
4. `TEST_AS_SPECIFIC_USER.sql` - Test as a specific user
5. `TEST_SUBSCRIPTIONS_WITH_USER.sql` - Test subscriptions access with user

**Run these only if you need to debug issues.**

---

## Quick Fix Scripts (Alternative - Not Needed If Running Comprehensive Fix)

These are **alternatives** to the comprehensive fix, but you don't need them if you run `FIX_ALL_RLS_ISSUES.sql`:

- `FIX_SUBSCRIPTIONS_RLS_WITH_FALLBACK.sql` - Quick fix for subscriptions only
- `FIX_SUBSCRIPTIONS_DIRECT_QUERY.sql` - Alternative subscriptions fix

**Status**: ⚠️ Not needed if you run `FIX_ALL_RLS_ISSUES.sql`

---

## Summary: What You Actually Need to Do

### ✅ SIMPLE APPROACH (Recommended)

1. **Run**: `migrations/FIX_ALL_RLS_ISSUES.sql`
2. **Done!** That's it.

### ✅ IF YOU ALREADY RAN SOME SCRIPTS

If you already ran `FIX_FUNCTION_PERMISSIONS.sql` or other scripts:
- **Still run**: `migrations/FIX_ALL_RLS_ISSUES.sql`
- It's idempotent (safe to run multiple times)
- It will update everything to the correct state

---

## After Running Migration

1. **Restart your Next.js dev server** (important!)
2. **Clear browser cache** (or use incognito)
3. **Log in as regular user**
4. **Test package features** - they should work now

---

## Troubleshooting

If after running `FIX_ALL_RLS_ISSUES.sql` you still have issues:

1. **Check browser console** - Look for errors
2. **Check server logs** - Look for `[OrganizationContext]` messages
3. **Run diagnostic scripts** - Use `CHECK_FUNCTION_AND_COLUMN.sql` or `TEST_SUBSCRIPTIONS_WITH_USER.sql`
4. **Test in app** - SQL Editor has no auth context, so test in your actual app

---

## TL;DR

**Just run `migrations/FIX_ALL_RLS_ISSUES.sql` - that's all you need!**

