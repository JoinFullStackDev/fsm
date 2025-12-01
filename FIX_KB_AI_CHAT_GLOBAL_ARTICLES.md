# Fix: KB AI Chat Not Finding Global Articles in Production

## Problem
AI chat works locally but not in production. Articles are global (`organization_id IS NULL`) and should be accessible to any logged-in user.

## Root Cause Analysis

Since `user_organization_id()` returns NULL (expected for global articles), the RAG search filters to:
```sql
WHERE published = true
  AND vector IS NOT NULL
  AND organization_id IS NULL
```

**Most likely issues:**

1. **Articles don't have embeddings** (`vector IS NULL`)
   - The RAG search requires `vector IS NOT NULL` for semantic search
   - If no articles have embeddings, it falls back to full-text search
   - If full-text search also fails, returns empty array

2. **RLS blocking the query**
   - The RLS policy requires `auth.uid() IS NOT NULL`
   - In production, auth context might not be passed correctly
   - Or the Supabase client isn't reading cookies properly

3. **Category join failing**
   - The RAG query joins with `knowledge_base_categories`
   - If RLS on categories blocks the join, query fails

## Diagnosis

### Step 1: Check if articles have embeddings

Run in production Supabase:

```sql
SELECT 
  COUNT(*) FILTER (WHERE published = true AND organization_id IS NULL) as global_articles,
  COUNT(*) FILTER (WHERE published = true AND organization_id IS NULL AND vector IS NOT NULL) as global_with_embeddings
FROM knowledge_base_articles;
```

**If `global_with_embeddings = 0`**, that's the problem! Articles need embeddings.

### Step 2: Test the exact RAG query

```sql
-- This is the exact query RAG search uses
SELECT COUNT(*) 
FROM knowledge_base_articles
WHERE published = true
  AND vector IS NOT NULL
  AND organization_id IS NULL;
```

If this returns 0, either:
- Articles don't have embeddings (most likely)
- RLS is blocking the query

### Step 3: Check production logs

Look for these log messages:
- `[KB RAG] No articles with embeddings found, falling back to full-text search`
- `[KB RAG] Vector search error:` - RLS or query error
- `[KB RAG] Full-text search failed` - Full-text search also failing

## Solutions

### Solution 1: Generate Embeddings for Articles (Most Likely Fix)

If articles don't have embeddings, generate them:

**Option A: Use API endpoint**
```bash
# Call in production (as admin/PM)
POST /api/kb/articles/generate-embeddings
Body: { "limit": 50 }
```

Repeat until all articles have embeddings.

**Option B: Use the script**
```bash
# Run locally (connects to same database)
npx tsx scripts/generate-kb-embeddings.ts
```

**Option C: Check if embeddings were generated**
```sql
-- See which articles need embeddings
SELECT id, title
FROM knowledge_base_articles
WHERE published = true
  AND organization_id IS NULL
  AND vector IS NULL
LIMIT 10;
```

### Solution 2: Fix RLS if Blocking

If RLS is the issue, test as the production user:

```sql
-- Test RLS policy
SET LOCAL request.jwt.claim.sub = 'production-user-auth-id';
SELECT COUNT(*) 
FROM knowledge_base_articles
WHERE published = true
  AND organization_id IS NULL;
```

If this returns 0 but the admin query returns articles, RLS is blocking.

**Fix:** Ensure `auth.uid()` is set correctly. Check:
- Supabase client is reading cookies properly
- Auth session is valid in production
- RLS policy allows: `auth.uid() IS NOT NULL`

### Solution 3: Check Category Join

If the category join is failing:

```sql
-- Test the join
SELECT 
  kba.id,
  kba.title,
  kbc.name as category_name
FROM knowledge_base_articles kba
LEFT JOIN knowledge_base_categories kbc ON kba.category_id = kbc.id
WHERE kba.published = true
  AND kba.organization_id IS NULL
LIMIT 5;
```

If this fails, check RLS on `knowledge_base_categories` table.

### Solution 4: Temporary Workaround - Remove Vector Requirement

If you need a quick fix, you could modify `lib/kb/rag.ts` to not require embeddings:

```typescript
// In retrieveRelevantArticles function, line 87
// Change from:
.not('vector', 'is', null);

// To:
// .not('vector', 'is', null);  // Comment out or remove

// This will allow articles without embeddings to be found
// But semantic search won't work - will use full-text only
```

**Note:** This is a temporary workaround. You should generate embeddings for best results.

## Quick Fix Checklist

1. ✅ **Check if articles have embeddings** - Run diagnostic SQL
2. ✅ **If no embeddings, generate them** - Use API or script
3. ✅ **Test the exact RAG query** - Verify it returns articles
4. ✅ **Check production logs** - Look for RAG search errors
5. ✅ **Verify RLS allows access** - Test as production user

## Most Likely Fix

**Generate embeddings for global articles:**

```bash
# In production, call the API endpoint
POST /api/kb/articles/generate-embeddings
Body: { "limit": 50 }

# Or run the script locally (connects to same DB)
npx tsx scripts/generate-kb-embeddings.ts
```

After generating embeddings, test the AI chat again.

## Related Files

- `lib/kb/rag.ts` - RAG search implementation (line 87 requires `vector IS NOT NULL`)
- `app/api/kb/articles/generate-embeddings/route.ts` - Embedding generation endpoint
- `scripts/generate-kb-embeddings.ts` - Embedding generation script
- `migrations/diagnostics/TEST_KB_RAG_QUERY_PRODUCTION.sql` - Diagnostic queries

