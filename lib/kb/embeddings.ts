/**
 * Knowledge Base Embeddings Utility
 * Handles generation and storage of vector embeddings for semantic search
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';

/**
 * Generate embedding for text using OpenAI's API via Supabase
 * Uses OpenAI's text-embedding-ada-002 model (1536 dimensions) or text-embedding-3-small (1536)
 * Note: Supabase's pgvector typically uses 768 dimensions, so we'll use text-embedding-3-small
 * @param supabase - Supabase client instance
 * @param text - Text to generate embedding for
 * @returns Embedding vector (768 dimensions) or null if failed
 */
export async function generateEmbedding(
  supabase: SupabaseClient,
  text: string
): Promise<number[] | null> {
  try {
    if (!text || text.trim().length === 0) {
      logger.warn('[KB Embeddings] Empty text provided for embedding');
      return null;
    }

    // Truncate text if too long (embedding models have token limits)
    // text-embedding-3-small has a limit of ~8191 tokens, roughly 30,000 characters
    const maxLength = 30000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    // Try to use Supabase's embed() function via RPC
    // If that fails, fall back to direct OpenAI API call
    const { data: rpcData, error: rpcError } = await supabase.rpc('embed', {
      text: truncatedText,
    });

    if (!rpcError && rpcData && Array.isArray(rpcData)) {
      // If RPC call succeeded and returned array, use it
      if (rpcData.length === 768) {
        return rpcData as number[];
      }
      // If dimensions don't match, we'll fall through to API call
    }

    // Fallback: Call OpenAI API directly
    // This requires OPENAI_API_KEY to be set
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logger.error('[KB Embeddings] No embedding API available - OPENAI_API_KEY not set');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // 1536 dimensions, we'll truncate to 768
        input: truncatedText,
        dimensions: 768, // Request 768 dimensions to match pgvector schema
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('[KB Embeddings] OpenAI API error:', {
        status: response.status,
        error: errorData,
      });
      return null;
    }

    const result = await response.json();
    const embedding = result.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      logger.error('[KB Embeddings] Invalid embedding format from OpenAI');
      return null;
    }

    // Ensure we have exactly 768 dimensions
    if (embedding.length !== 768) {
      logger.warn(`[KB Embeddings] Embedding has ${embedding.length} dimensions, expected 768`);
      // Truncate or pad to 768 dimensions
      const adjustedEmbedding = embedding.slice(0, 768);
      while (adjustedEmbedding.length < 768) {
        adjustedEmbedding.push(0);
      }
      return adjustedEmbedding;
    }

    return embedding as number[];
  } catch (error) {
    logger.error('[KB Embeddings] Exception generating embedding:', error);
    return null;
  }
}

/**
 * Generate embedding for article content
 * Combines title, summary, and body for comprehensive embedding
 * @param supabase - Supabase client instance
 * @param article - Article data
 * @returns Embedding vector or null if failed
 */
export async function generateArticleEmbedding(
  supabase: SupabaseClient,
  article: {
    title: string;
    summary?: string | null;
    body: string;
  }
): Promise<number[] | null> {
  try {
    // Combine title, summary, and body for embedding
    const textParts: string[] = [article.title];

    if (article.summary) {
      textParts.push(article.summary);
    }

    textParts.push(article.body);

    const combinedText = textParts.join('\n\n');

    return await generateEmbedding(supabase, combinedText);
  } catch (error) {
    logger.error('[KB Embeddings] Error generating article embedding:', error);
    return null;
  }
}

/**
 * Store embedding in database
 * @param supabase - Supabase client instance
 * @param articleId - Article ID
 * @param embedding - Embedding vector
 * @returns True if successful
 */
export async function storeEmbedding(
  supabase: SupabaseClient,
  articleId: string,
  embedding: number[]
): Promise<boolean> {
  try {
    // Convert array to PostgreSQL vector format: '[0.1,0.2,0.3]'
    const vectorString = '[' + embedding.join(',') + ']';

    const { error } = await supabase
      .from('knowledge_base_articles')
      .update({
        vector: vectorString,
      })
      .eq('id', articleId);

    if (error) {
      logger.error('[KB Embeddings] Error storing embedding:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[KB Embeddings] Exception storing embedding:', error);
    return false;
  }
}

/**
 * Generate and store embedding for an article
 * @param supabase - Supabase client instance
 * @param articleId - Article ID
 * @param article - Article data
 * @returns True if successful
 */
export async function generateAndStoreEmbedding(
  supabase: SupabaseClient,
  articleId: string,
  article: {
    title: string;
    summary?: string | null;
    body: string;
  }
): Promise<boolean> {
  try {
    const embedding = await generateArticleEmbedding(supabase, article);

    if (!embedding) {
      logger.warn('[KB Embeddings] Failed to generate embedding for article:', articleId);
      return false;
    }

    return await storeEmbedding(supabase, articleId, embedding);
  } catch (error) {
    logger.error('[KB Embeddings] Error in generateAndStoreEmbedding:', error);
    return false;
  }
}

/**
 * Update embedding if article content changed
 * @param supabase - Supabase client instance
 * @param articleId - Article ID
 * @param oldArticle - Previous article data
 * @param newArticle - Updated article data
 * @returns True if embedding was updated
 */
export async function updateEmbeddingIfChanged(
  supabase: SupabaseClient,
  articleId: string,
  oldArticle: {
    title: string;
    summary?: string | null;
    body: string;
  },
  newArticle: {
    title: string;
    summary?: string | null;
    body: string;
  }
): Promise<boolean> {
  try {
    // Check if content changed
    const contentChanged =
      oldArticle.title !== newArticle.title ||
      oldArticle.summary !== newArticle.summary ||
      oldArticle.body !== newArticle.body;

    if (!contentChanged) {
      return false; // No update needed
    }

    // Regenerate and store embedding
    return await generateAndStoreEmbedding(supabase, articleId, newArticle);
  } catch (error) {
    logger.error('[KB Embeddings] Error updating embedding:', error);
    return false;
  }
}

/**
 * Generate embedding for search query
 * @param supabase - Supabase client instance
 * @param query - Search query text
 * @returns Embedding vector or null if failed
 */
export async function generateQueryEmbedding(
  supabase: SupabaseClient,
  query: string
): Promise<number[] | null> {
  return await generateEmbedding(supabase, query);
}

