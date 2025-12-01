# Fix: KB AI Chat Works Locally But Not in Production

## Problem
AI chat works fine locally but returns "I couldn't find any relevant articles" in production, even though:
- Same database is used
- Gemini API key works (AI works elsewhere in production)
- Regular KB search/listing works

## Root Cause

The issue is likely with **RLS (Row Level Security) policies** and the `user_organization_id()` function. The RAG search query is being blocked by RLS in production.

### Key Differences

1. **Chat endpoint uses `getUserOrganizationId()`** which:
   - Tries RPC function `user_organization_id()` first
   - Falls back to direct query if RPC fails
   - This works in the application layer

2. **RLS policies use `user_organization_id()` directly** in the database:
   - If this function fails or returns NULL, RLS blocks access
   - The function might not have `SECURITY DEFINER` set correctly
   - Production auth context might be different

3. **The RAG query filters by `vector IS NOT NULL`**:
   - If RLS blocks the query, no articles are returned
   - Falls back to full-text search, which also gets blocked by RLS

## Diagnosis

### Step 1: Check if `user_organization_id()` function has SECURITY DEFINER

Run in production Supabase SQL editor:

```sql
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✅'
    ELSE 'SECURITY INVOKER ❌ - NEEDS FIX'
  END as security_type,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'user_organization_id';
```

If it shows `SECURITY INVOKER`, that's the problem!

### Step 2: Test the RPC function

```sql
-- This should return your organization_id or NULL
SELECT user_organization_id();
```

If this returns NULL or errors in production, that's the issue.

### Step 3: Check production logs

Look for these in production logs:
- `[KB RAG] Vector search error:` - RLS blocking the query
- `[KB RAG] No articles with embeddings found` - Query returned empty
- `[OrganizationContext] RPC user_organization_id failed` - RPC function failing

## Solution

### Fix 1: Ensure `user_organization_id()` has SECURITY DEFINER

Run this in production Supabase:

```sql
-- Recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION user_organization_id()
RETURNS uuid 
LANGUAGE sql 
STABLE
SECURITY DEFINER  -- This is critical!
SET search_path = public
AS $$
  SELECT organization_id 
  FROM users 
  WHERE auth_id = auth.uid();
$$;
```

### Fix 2: Verify RLS policies allow the query

The RAG search needs to query articles with this filter:
- `published = true`
- `vector IS NOT NULL`
- `organization_id = user_organization_id() OR organization_id IS NULL`

Test if this works:

```sql
-- Test as the production user (replace with actual auth_id)
SET LOCAL request.jwt.claim.sub = 'production-user-auth-id';
SELECT COUNT(*) 
FROM knowledge_base_articles
WHERE published = true
  AND vector IS NOT NULL
  AND (
    organization_id = user_organization_id() 
    OR organization_id IS NULL
  );
```

If this returns 0, RLS is blocking.

### Fix 3: Use admin client for RAG search (temporary workaround)

If RLS is the issue, you could modify `lib/kb/rag.ts` to use admin client:

```typescript
// In retrieveRelevantArticles function
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';

// Use admin client to bypass RLS
const adminClient = createAdminSupabaseClient();
let articlesQuery = adminClient
  .from('knowledge_base_articles')
  // ... rest of query
```

**Note:** This bypasses RLS, so only do this if you're sure the application-level checks are sufficient.

### Fix 4: Check if category join is blocking

The RAG query joins with `knowledge_base_categories`. If RLS on categories is blocking, the join fails:

```sql
-- Test the join
SELECT 
  kba.id,
  kba.title,
  kbc.name as category_name
FROM knowledge_base_articles kba
LEFT JOIN knowledge_base_categories kbc ON kba.category_id = kbc.id
WHERE kba.published = true
  AND kba.vector IS NOT NULL
LIMIT 5;
```

## Quick Fix Checklist

1. ✅ **Check `user_organization_id()` has SECURITY DEFINER**
2. ✅ **Test RPC function returns correct organization_id**
3. ✅ **Verify RLS policies allow reading published articles**
4. ✅ **Check production logs for RLS errors**
5. ✅ **Test the exact query the RAG search uses**

## Most Likely Fix

Run this in production Supabase SQL editor:

```sql
-- Fix the user_organization_id function
CREATE OR REPLACE FUNCTION user_organization_id()
RETURNS uuid 
LANGUAGE sql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM users 
  WHERE auth_id = auth.uid();
$$;

-- Also fix the helper functions
CREATE OR REPLACE FUNCTION is_admin_or_pm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'pm')
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND role = 'admin'
  );
$$;
```

Then test the AI chat again in production.

## Related Files

- `migrations/schema/add_knowledge_base_rls.sql` - RLS policies
- `migrations/fixes/fix_kb_rls_functions_if_needed.sql` - Function fixes
- `lib/kb/rag.ts` - RAG search implementation
- `app/api/ai/kb/chat/route.ts` - AI chat endpoint
- `lib/organizationContext.ts` - getUserOrganizationId function

