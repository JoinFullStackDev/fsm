# Debug Company Admin Access Issues

## Quick Checks

### 1. Check Browser Console
Open DevTools → Console tab when logged in as company admin:
- Look for errors from `/api/organization/context`
- Check if the response is `{ organization: null, subscription: null, package: null }`

### 2. Check Network Tab
Open DevTools → Network tab:
- Find `/api/organization/context` request
- Check the response - what does it return?
- Check status code (200? 500?)

### 3. Check Server Logs
Look at your Next.js terminal/console:
- Look for `[OrganizationContext]` log messages
- Look for errors like:
  - "Error fetching organization"
  - "Error fetching subscription"
  - "Error fetching package"
  - "No subscription found"

### 4. Check Database
Run this query (replace with actual company admin email):
```sql
SELECT 
  u.id,
  u.email,
  u.organization_id,
  o.name as org_name,
  o.module_overrides,
  s.id as subscription_id,
  s.package_id,
  s.status as subscription_status,
  p.name as package_name,
  p.features
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN subscriptions s ON s.organization_id = u.organization_id
LEFT JOIN packages p ON p.id = s.package_id
WHERE u.email = 'company-admin@example.com'  -- Replace with actual email
ORDER BY s.created_at DESC
LIMIT 1;
```

This will show:
- ✅ Does user have organization_id?
- ✅ Does organization exist?
- ✅ Does organization have module_overrides?
- ✅ Does subscription exist?
- ✅ Does subscription have package_id?
- ✅ Does package exist?
- ✅ Does package have features?

## Common Issues

### Issue 1: No Subscription
**Symptom:** `subscription: null` in API response
**Fix:** Create a subscription for the organization

### Issue 2: Subscription Has No Package
**Symptom:** `subscription` exists but `package: null`
**Fix:** Update subscription to have a `package_id`

### Issue 3: Package Has No Features
**Symptom:** `package` exists but `features: null` or empty
**Fix:** Update package to have features JSON

### Issue 4: Organization Has No module_overrides
**Symptom:** `module_overrides` is null or empty
**Fix:** Set module_overrides in organization record

## Next Steps

1. Run the diagnostic query above
2. Share the results
3. Check browser console/network tab
4. Check server logs
5. Share what you find

This will help identify if it's:
- Database issue (missing data)
- RLS issue (policies blocking)
- Code issue (API not working)

