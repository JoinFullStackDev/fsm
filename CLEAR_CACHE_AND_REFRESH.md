# Clear Cache and Refresh User Data

## The Problem

You updated `is_company_admin` in the database, but the app is still showing old values. This is likely due to:

1. **Browser cache** - Old user data cached in browser
2. **API cache** - Organization context cache (30 second TTL)
3. **Component state** - React components haven't refreshed

## Quick Fixes

### 1. Clear Browser Cache
- **Chrome/Edge**: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- **Or**: Use Incognito/Private mode
- **Or**: Hard refresh: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

### 2. Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 3. Clear Organization Context Cache
The organization context is cached for 30 seconds. You can:
- Wait 30 seconds and refresh
- Or restart the dev server (clears in-memory cache)

### 4. Force Refresh User Data
After clearing cache, log out and log back in to force fresh user data fetch.

## Verify It's Working

### Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Type: `fetch('/api/users/me').then(r => r.json()).then(console.log)`
4. Check if `is_company_admin` is correct

### Check Network Tab
1. Open DevTools → Network tab
2. Refresh page
3. Find `/api/users/me` request
4. Check response - does it include `is_company_admin` with correct value?

## If Still Not Working

### Check Database
Run this query to verify the database has the correct value:
```sql
SELECT 
  email,
  role,
  is_super_admin,
  is_company_admin,
  organization_id
FROM users
WHERE email = 'your-email@example.com';  -- Replace with your email
```

### Check API Response
The `/api/users/me` endpoint should return the full user object including `is_company_admin`. If it doesn't, the `getUserByAuthId` function might not be selecting it.

### Check Code Updates
Make sure you've:
- ✅ Run the migration
- ✅ Updated `is_company_admin` in database
- ✅ Restarted dev server
- ✅ Cleared browser cache
- ✅ Logged out and back in

## Updated Code

The `useRole` hook now returns `isCompanyAdmin`. Components can use it like:

```typescript
const { role, isSuperAdmin, isCompanyAdmin, loading } = useRole();

if (isCompanyAdmin) {
  // Show company admin features
}
```

