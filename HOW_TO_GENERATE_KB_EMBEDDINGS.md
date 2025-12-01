# How to Generate KB Embeddings

## Option 1: Browser Console (Easiest - If You're Logged In)

1. **Go to your production site** (e.g., `https://your-domain.com`)
2. **Log in as admin or PM**
3. **Open browser console** (F12 or Right-click → Inspect → Console)
4. **Paste and run this:**

```javascript
// Generate embeddings for 50 articles at a time
async function generateEmbeddings(limit = 50) {
  const response = await fetch('/api/kb/articles/generate-embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit }),
  });
  
  const result = await response.json();
  console.log('Result:', result);
  return result;
}

// Run it
generateEmbeddings(50).then(result => {
  console.log(`✅ Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`);
  
  // If there are more articles, run again
  if (result.processed > 0) {
    console.log('Run generateEmbeddings(50) again to process more articles');
  }
});
```

5. **Keep running `generateEmbeddings(50)`** until `processed: 0`

## Option 2: Terminal with curl (If You Have Auth Cookie)

1. **Get your auth cookie** from browser:
   - Open DevTools → Application/Storage → Cookies
   - Find cookie named like `sb-xxx-auth-token` or similar
   - Copy the value

2. **Run in terminal:**

```bash
# Replace YOUR_DOMAIN and YOUR_COOKIE_VALUE
curl -X POST https://YOUR_DOMAIN.com/api/kb/articles/generate-embeddings \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-xxx-auth-token=YOUR_COOKIE_VALUE" \
  -d '{"limit": 50}'
```

3. **Repeat until it returns `"processed": 0`**

## Option 3: Use the Script (Recommended - No Auth Needed)

This is the **easiest option** because it uses the admin client (bypasses auth):

1. **Make sure you have environment variables set:**
   ```bash
   # Check if these are set
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   echo $GEMINI_API_KEY  # Or check admin_settings table
   ```

2. **Run the script:**
   ```bash
   npx tsx scripts/generate-kb-embeddings.ts
   ```

3. **The script will:**
   - Process all articles without embeddings
   - Show progress for each article
   - Handle rate limiting automatically
   - Report final statistics

**Note:** The script uses the admin client, so it doesn't need you to be logged in. It connects directly to the database.

## Option 4: Create a Simple Node Script

Create a file `generate-embeddings-now.js`:

```javascript
// generate-embeddings-now.js
const fetch = require('node-fetch'); // or use built-in fetch in Node 18+

async function generateEmbeddings() {
  const url = 'https://YOUR_PRODUCTION_DOMAIN.com/api/kb/articles/generate-embeddings';
  const cookie = 'YOUR_AUTH_COOKIE_HERE'; // Get from browser
  
  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  
  while (true) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify({ limit: 50 }),
    });
    
    const result = await response.json();
    console.log('Batch result:', result);
    
    totalProcessed += result.processed || 0;
    totalSucceeded += result.succeeded || 0;
    totalFailed += result.failed || 0;
    
    if (result.processed === 0) {
      console.log('\n✅ Done!');
      console.log(`Total: ${totalProcessed} processed, ${totalSucceeded} succeeded, ${totalFailed} failed`);
      break;
    }
    
    // Wait a bit before next batch
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

generateEmbeddings();
```

Then run: `node generate-embeddings-now.js`

## Recommended: Use Option 3 (The Script)

The script (`scripts/generate-kb-embeddings.ts`) is the best option because:
- ✅ No authentication needed (uses admin client)
- ✅ Handles all articles automatically
- ✅ Shows progress
- ✅ Handles errors gracefully
- ✅ Works from your local machine (connects to same database)

Just run:
```bash
npx tsx scripts/generate-kb-embeddings.ts
```

Make sure your `.env` file has:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (or it will use the one from admin_settings)

## Verify It Worked

After generating embeddings, check:

```sql
SELECT 
  COUNT(*) FILTER (WHERE published = true AND organization_id IS NULL AND vector IS NOT NULL) as global_with_embeddings
FROM knowledge_base_articles;
```

This should equal the total number of published global articles.

