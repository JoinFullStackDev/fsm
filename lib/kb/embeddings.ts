/**
 * Knowledge Base Embeddings Utility
 * Handles generation and storage of vector embeddings for semantic search
 * Uses Google's text-embedding-004 model (768 dimensions) via Gemini API
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';

/**
 * Generate embedding for text using Google's embedding API via Gemini
 * Uses Google's text-embedding-004 model (768 dimensions)
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
    // text-embedding-004 has a limit of ~2048 tokens, roughly 8,000 characters
    const maxLength = 8000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    // Try to use Supabase's embed() function via RPC first (if configured)
    const { data: rpcData, error: rpcError } = await supabase.rpc('embed', {
      text: truncatedText,
    });

    if (!rpcError && rpcData && Array.isArray(rpcData)) {
      // If RPC call succeeded and returned array, use it
      if (rpcData.length === 768) {
        logger.debug('[KB Embeddings] Using Supabase RPC embed() function');
        return rpcData as number[];
      }
      // If dimensions don't match, we'll fall through to API call
    }

    // Use Google's embedding API via Gemini API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      logger.error('[KB Embeddings] No embedding API available - GEMINI_API_KEY not set');
      return null;
    }

    // Google's embedding API endpoint
    // Using text-embedding-004 which produces 768-dimensional vectors
    // API endpoint: https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: truncatedText }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      logger.error('[KB Embeddings] Google Embedding API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return null;
    }

    const result = await response.json();
    // Google's API returns embedding in result.embedding.values
    const embedding = result.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      logger.error('[KB Embeddings] Invalid embedding format from Google API', {
        resultKeys: Object.keys(result),
        embeddingType: typeof result.embedding,
        hasValues: !!result.embedding?.values,
      });
      return null;
    }

    // Google's text-embedding-004 produces 768 dimensions
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
    // Use admin client to bypass RLS for updating embeddings
    const adminClient = createAdminSupabaseClient();
    
    // Supabase/PostgreSQL vector type accepts array directly
    // Format: '[0.1,0.2,0.3]' as string for pgvector
    const vectorString = '[' + embedding.join(',') + ']';

    const { error } = await adminClient
      .from('knowledge_base_articles')
      .update({
        vector: vectorString,
      })
      .eq('id', articleId);

    if (error) {
      logger.error('[KB Embeddings] Error storing embedding:', {
        articleId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        vectorLength: embedding.length,
      });
      return false;
    }

    logger.debug('[KB Embeddings] Successfully stored embedding for article:', articleId);
    return true;
  } catch (error) {
    logger.error('[KB Embeddings] Exception storing embedding:', {
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
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

