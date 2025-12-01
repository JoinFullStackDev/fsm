# Fix: KB AI Search Works Locally But Not in Production

## Problem
The AI question sidebar works fine in local development but returns "I couldn't find any relevant articles" in production, even though they use the same database.

## Root Cause Analysis

Since both environments use the same database, the issue is likely:

1. **Missing GEMINI_API_KEY in production** - The most common cause
   - Production environment doesn't have `GEMINI_API_KEY` or `GOOGLE_GENAI_API_KEY` set
   - Without the API key, query embedding generation fails
   - Falls back to full-text search, which may also fail

2. **RLS Policy Differences** - Different user context in production
   - Production user might have different organization_id
   - RLS policies might be filtering out articles differently

3. **Full-Text Search Issues** - Fallback search failing
   - `search_vector` column might not have proper index
   - Full-text search might be failing silently

## Diagnosis Steps

### Step 1: Check Environment Variables in Production

**Vercel/Production Environment:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Verify `GEMINI_API_KEY` or `GOOGLE_GENAI_API_KEY` is set
3. Make sure it's set for **Production** environment (not just Preview/Development)

**Check via API:**
```bash
# This should return the API key (masked) or null
curl https://your-production-domain.com/api/admin/settings/gemini-key \
  -H "Cookie: your-auth-cookie"
```

### Step 2: Run Diagnostic SQL

Run the diagnostic script in production Supabase:
```sql
-- Run: migrations/diagnostics/DIAGNOSE_KB_AI_SEARCH_PRODUCTION.sql
```

This will check:
- API key configuration in database
- Articles and embeddings status
- RLS policies
- Full-text search functionality

### Step 3: Check Production Logs

Look for these log messages in production:
- `[KB RAG] Failed to generate query embedding` - API key issue
- `[KB RAG] Vector search error` - RLS or query issue
- `[KB RAG] Full-text search failed` - Full-text search issue
- `[Gemini Config] Using API key from environment variable` - Good sign
- `[Gemini Config] Using API key from admin_settings` - Fallback working

## Solutions

### Solution 1: Set GEMINI_API_KEY in Production (Most Likely Fix)

**If using Vercel:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - **Name**: `GEMINI_API_KEY` (or `GOOGLE_GENAI_API_KEY`)
   - **Value**: Your Gemini API key
   - **Environment**: Production (and Preview if needed)
3. **Redeploy** the application (environment variables require redeploy)

**If using other hosting:**
- Set the environment variable in your hosting platform
- Restart/redeploy the application

**Verify it's working:**
After redeploy, check the logs for:
```
[Gemini Config] Using API key from environment variable (super admin credentials)
```

### Solution 2: Check RLS Policies

If API key is set but still not working, check RLS:

```sql
-- Check current RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'knowledge_base_articles';

-- Test as a specific user (replace with actual user auth_id)
SET LOCAL request.jwt.claim.sub = 'user-auth-id-here';
SELECT COUNT(*) FROM knowledge_base_articles WHERE published = true;
```

If RLS is blocking, you may need to adjust policies. See:
- `migrations/schema/add_knowledge_base_rls.sql`
- `migrations/fixes/fix_kb_rls_functions_if_needed.sql`

### Solution 3: Verify Full-Text Search Fallback

Even if embeddings fail, full-text search should work:

```sql
-- Test full-text search
SELECT id, title
FROM knowledge_base_articles
WHERE published = true
  AND search_vector @@ plainto_tsquery('english', 'project')
LIMIT 5;
```

If this fails, check:
- `search_vector` column exists
- GIN index exists on `search_vector`
- Articles have `search_vector` populated

### Solution 4: Check Organization Context

The search filters by `organization_id`. In production, the user might have a different organization:

```sql
-- Check what organization_id the production user has
SELECT id, email, organization_id
FROM users
WHERE email = 'your-production-user@example.com';
```

Then verify articles are accessible:
```sql
-- Replace YOUR_ORG_ID with the actual organization_id
SELECT COUNT(*)
FROM knowledge_base_articles
WHERE published = true
  AND (organization_id IS NULL OR organization_id = 'YOUR_ORG_ID'::uuid);
```

## Quick Fix Checklist

- [ ] **GEMINI_API_KEY is set in production environment variables**
- [ ] **Application was redeployed after setting environment variable**
- [ ] **API key is valid and has quota** (check Google Cloud Console)
- [ ] **RLS policies allow reading published articles**
- [ ] **Full-text search works as fallback** (test with SQL)
- [ ] **Production logs show API key is being used**

## Testing After Fix

1. Go to production knowledge base
2. Open AI question sidebar
3. Ask: "How do I create a project?"
4. Should now find relevant articles and provide answer

## Monitoring

After fixing, monitor production logs for:
- `[KB RAG]` messages - Should show successful embedding generation
- `[Gemini Config]` messages - Should show API key from env var
- Any errors in `/api/ai/kb/chat` endpoint

## Related Files

- `lib/utils/geminiConfig.ts` - API key retrieval logic
- `lib/kb/embeddings.ts` - Embedding generation
- `lib/kb/rag.ts` - RAG search implementation
- `app/api/ai/kb/chat/route.ts` - AI chat endpoint

