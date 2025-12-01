# RLS Policy Analysis & Fix Plan

## ✅ Issue Found: Packages Policy

**Current Policy:**
```sql
"Authenticated users can view packages"
USING (auth.uid() IS NOT NULL)  -- ❌ Blocks anonymous users
```

**Problem:** Pricing pages need to work for logged-out users, but this policy blocks them.

**Fix:** Already created `FIX_PACKAGES_PUBLIC_NOW.sql` - run this immediately!

---

## 🔍 Need More Info

I need to see the policies for these critical tables to identify recursion issues:

1. **users** - Need to see all 5 SELECT policies
2. **organizations** - Need to see all 2 SELECT policies  
3. **subscriptions** - Need to see all 2 SELECT policies
4. **projects** - Need to see all 2 SELECT policies

**Run this query to get them:**

```sql
SELECT 
  tablename,
  policyname,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'organizations', 'subscriptions', 'projects')
ORDER BY tablename, cmd, policyname;
```

---

## 🎯 What I'm Looking For

### 1. Users Table Policies
- Should have a policy allowing users to read their own record: `USING (auth.uid() = auth_id)`
- Should NOT have policies that query users table recursively
- Should use `user_organization_id()` function OR direct query with fallback

### 2. Organizations Table Policies
- Should allow reading own organization
- Should NOT query users table directly (causes recursion)
- Should use `user_organization_id()` function OR direct query with fallback

### 3. Subscriptions Table Policies
- Should allow reading subscriptions for own organization
- Should NOT query users table directly (causes recursion)
- Should use direct query: `organization_id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid())`

### 4. Projects Table Policies
- Should allow reading projects in own organization
- Should use `user_organization_id()` function OR direct query

---

## 📋 Next Steps

1. **Run `FIX_PACKAGES_PUBLIC_NOW.sql`** - Fixes pricing page immediately
2. **Share the critical policies** - Run the query above and share results
3. **I'll build comprehensive fix** - Based on what I see, I'll create a complete fix

---

## 🚨 Potential Issues I'm Looking For

1. **Recursion:** Policies that query `users` table when checking `users` table policies
2. **Missing Fallbacks:** Policies that only use `user_organization_id()` without fallback
3. **Blocked Anonymous:** Policies that block anonymous users when they shouldn't
4. **Missing Policies:** Tables that need RLS but don't have policies

Share the critical policies and I'll build the complete fix! 🎯

