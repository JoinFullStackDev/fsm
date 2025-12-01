# Fix: Knowledge Base AI Search Not Finding Articles

## Problem
The AI question sidebar in the knowledge base returns:
> "I couldn't find any relevant articles in the knowledge base to answer your question."

## Root Cause
The knowledge base articles were migrated to production, but they **don't have embeddings** (vector column is null). The AI search requires embeddings for semantic search to work.

## Diagnosis Steps

### 1. Check Article Status
Run the diagnostic script to see the current state:

```sql
-- Run: migrations/diagnostics/CHECK_KB_ARTICLES_AND_EMBEDDINGS.sql
```

Or manually check:
```sql
SELECT 
  COUNT(*) FILTER (WHERE published = true) as published_articles,
  COUNT(*) FILTER (WHERE published = true AND vector IS NOT NULL) as articles_with_embeddings,
  COUNT(*) FILTER (WHERE published = true AND vector IS NULL) as articles_needing_embeddings
FROM knowledge_base_articles;
```

### 2. Verify GEMINI_API_KEY
The embedding generation requires a Gemini API key. Check that it's configured:
- Environment variable: `GEMINI_API_KEY`
- Or in Supabase: Check if the `embed()` RPC function is configured

## Solution: Generate Embeddings

You have three options to generate embeddings:

### Option 1: Use the API Endpoint (Recommended)
Call the API endpoint in batches:

```bash
# Process 50 articles at a time
curl -X POST https://your-domain.com/api/kb/articles/generate-embeddings \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"limit": 50}'
```

Repeat until all articles have embeddings.

### Option 2: Use the Script (Best for Bulk Processing)
Run the TypeScript script:

```bash
# Make sure GEMINI_API_KEY is set
export GEMINI_API_KEY=your-key-here

# Run the script
npx tsx scripts/generate-kb-embeddings.ts
```

This script will:
- Process all articles without embeddings
- Show progress as it works
- Handle rate limiting
- Report final statistics

### Option 3: Manual via Admin Panel
If you have admin access, you can trigger embedding generation through the UI (if that feature exists).

## Verification

After generating embeddings, verify they were created:

```sql
SELECT 
  COUNT(*) FILTER (WHERE published = true AND vector IS NOT NULL) as articles_with_embeddings
FROM knowledge_base_articles;
```

All published articles should now have embeddings.

## Testing

1. Go to the knowledge base in production
2. Open the AI question sidebar
3. Ask a question like "How do I create a project?"
4. The AI should now find relevant articles and provide an answer

## Troubleshooting

### Still Not Finding Articles?

1. **Check RLS Policies**: Ensure RLS policies allow reading published articles
   ```sql
   -- Run: migrations/diagnostics/CHECK_KB_ARTICLES_AND_EMBEDDINGS.sql
   -- Look at the RLS policies section
   ```

2. **Check Embedding Generation**: Verify embeddings were actually created
   ```sql
   SELECT id, title, vector IS NOT NULL as has_embedding
   FROM knowledge_base_articles
   WHERE published = true
   LIMIT 10;
   ```

3. **Check API Key**: Ensure GEMINI_API_KEY is valid and has quota
   - Test by calling the embedding API directly
   - Check Supabase logs for API errors

4. **Check Full-Text Search Fallback**: If embeddings fail, the system falls back to full-text search
   - Verify `search_vector` column exists and has data
   - Check if full-text search is working

### Rate Limiting
If you hit rate limits:
- Reduce batch size (use `limit: 10` instead of `50`)
- Add delays between batches
- Process over multiple sessions

### Missing Articles
If articles are missing:
- Verify they were migrated: Check `migrations/data/add_kb_articles_batch_*.sql` were run
- Check if articles are published: `published = true`
- Verify organization_id filter isn't excluding articles

## Prevention

To prevent this in the future:
1. **Auto-generate embeddings**: When creating new articles, embeddings are automatically generated (see `app/api/kb/articles/route.ts`)
2. **Monitor**: Add monitoring to alert when articles are created without embeddings
3. **Migration scripts**: Include embedding generation in data migration scripts

## Related Files

- `lib/kb/rag.ts` - RAG search implementation
- `lib/kb/embeddings.ts` - Embedding generation
- `app/api/kb/articles/generate-embeddings/route.ts` - Embedding API endpoint
- `app/api/ai/kb/chat/route.ts` - AI chat endpoint
- `migrations/data/add_kb_articles_batch_*.sql` - Article data migrations

