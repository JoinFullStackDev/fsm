/**
 * Script to generate embeddings for all knowledge base articles
 * Run this after migrating KB articles to production
 * 
 * Usage:
 *   npx tsx scripts/generate-kb-embeddings.ts
 * 
 * Requires:
 *   - GEMINI_API_KEY environment variable
 *   - Database connection configured
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { generateAndStoreEmbedding } from '@/lib/kb/embeddings';
import logger from '@/lib/utils/logger';

async function generateAllEmbeddings() {
  // Check for required environment variables
  if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: GEMINI_API_KEY or Supabase configuration not found');
    console.error('   Please set GEMINI_API_KEY environment variable');
    process.exit(1);
  }
  
  const adminClient = createAdminSupabaseClient();
  
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const failedArticles: Array<{ id: string; title: string; error: string }> = [];
  
  console.log('🚀 Starting embedding generation for knowledge base articles...\n');
  
  while (true) {
    // Fetch articles without embeddings
    const { data: articles, error } = await adminClient
      .from('knowledge_base_articles')
      .select('id, title, summary, body')
      .eq('published', true)
      .is('vector', null)
      .limit(50);
    
    if (error) {
      console.error('❌ Error fetching articles:', error);
      break;
    }
    
    if (!articles || articles.length === 0) {
      console.log('✅ No more articles to process\n');
      break;
    }
    
    console.log(`📝 Processing ${articles.length} articles...`);
    
    // Generate embeddings
    for (const article of articles) {
      try {
        const success = await generateAndStoreEmbedding(
          adminClient,
          article.id,
          {
            title: article.title,
            summary: article.summary || null,
            body: article.body,
          }
        );
        
        if (success) {
          succeeded++;
          console.log(`  ✅ ${article.title}`);
        } else {
          failed++;
          failedArticles.push({ id: article.id, title: article.title, error: 'Generation failed' });
          console.log(`  ❌ ${article.title}`);
        }
        processed++;
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        failedArticles.push({ id: article.id, title: article.title, error: errorMsg });
        console.error(`  ❌ Error processing ${article.title}:`, errorMsg);
      }
      
      // Small delay to avoid rate limiting (100ms between articles)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Progress: ${processed} processed, ${succeeded} succeeded, ${failed} failed\n`);
    
    // If we processed fewer than the limit, we're done
    if (articles.length < 50) {
      break;
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 Final Summary');
  console.log('='.repeat(60));
  console.log(`Total Processed: ${processed}`);
  console.log(`✅ Succeeded: ${succeeded}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failedArticles.length > 0) {
    console.log('\n❌ Failed Articles:');
    failedArticles.forEach(({ id, title, error }) => {
      console.log(`  - ${title} (${id}): ${error}`);
    });
  }
  
  // Verify final count
  const { count: finalCount } = await adminClient
    .from('knowledge_base_articles')
    .select('id', { count: 'exact', head: true })
    .eq('published', true)
    .is('vector', null);
  
  const remaining = finalCount || 0;
  if (remaining > 0) {
    console.log(`\n⚠️  Warning: ${remaining} articles still need embeddings`);
    console.log('   Run this script again to process remaining articles');
  } else {
    console.log('\n✅ All published articles now have embeddings!');
  }
  
  console.log('='.repeat(60) + '\n');
}

// Run the script
generateAllEmbeddings()
  .then(() => {
    console.log('✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

