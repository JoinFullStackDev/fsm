# How to Test user_organization_id() Function in Your App

## The Function Works in App Context (Not SQL Editor)

The function returning NULL in SQL Editor is **normal** - SQL Editor has no auth session.

## Test in Your App

### Step 1: Check Browser Console
1. Log in as a regular user in your app
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for errors like:
   - "stack depth limit exceeded"
   - "Failed to fetch"
   - "No subscription found"

### Step 2: Check Network Tab
1. In DevTools, go to Network tab
2. Filter by "Fetch/XHR"
3. Look for `/api/organization/context` request
4. Check the response:
   - Does it return organization data?
   - Does it return package features?
   - Any errors?

### Step 3: Check Server Logs
1. Look at your Next.js terminal/console
2. Look for `[OrganizationContext]` log messages
3. Check for:
   - "No subscription found" warnings
   - "Error fetching subscription" errors
   - "Error fetching package" errors

### Step 4: Test Specific Feature Access
1. Navigate to `/ops/companies` (or any ops tool page)
2. Check if you see "Ops Tool is not available" error
3. If yes → RLS policies are blocking subscription/package access
4. If no → Function is working!

## If Function Still Doesn't Work in App

If regular users still can't access package features:

### Run the Comprehensive RLS Migration

**You MUST run `migrations/FIX_ALL_RLS_ISSUES.sql`!**

This migration fixes:
- `user_organization_id()` function (with proper permissions)
- `subscriptions` table RLS policies
- `packages` table RLS policies
- `organizations` table RLS policies
- All other tables that cause recursion

### After Running Migration

1. **Restart your Next.js dev server** (important!)
2. **Clear browser cache** (or use incognito)
3. **Log in as regular user**
4. **Test package features** - they should work now

## Quick Test Script

Add this to your app temporarily to test the function:

```typescript
// In any page component, add this useEffect:
useEffect(() => {
  const testFunction = async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.rpc('user_organization_id');
    console.log('Function result:', data);
    console.log('Function error:', error);
  };
  testFunction();
}, []);
```

If this returns a UUID → function works!
If this returns NULL → RLS is blocking it (run migration)

