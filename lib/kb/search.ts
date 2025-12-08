/**
 * Knowledge Base Search Utility
 * Implements hybrid search combining full-text and vector similarity
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import { generateQueryEmbedding } from './embeddings';
import type { SearchQuery, SearchResult, KnowledgeBaseArticleWithCategory } from '@/types/kb';

// Internal type for article with vector that may be string
type ArticleWithVector = KnowledgeBaseArticleWithCategory & {
  vector: number[] | string | null;
};

// Type for query builder - kept generic due to complex Supabase typing
// This is an internal implementation detail
type QueryBuilder = ReturnType<SupabaseClient<Record<string, unknown>>['from']>;

/**
 * Perform hybrid search combining full-text and vector similarity
 * @param supabase - Supabase client instance
 * @param query - Search query parameters
 * @returns Array of search results with relevance scores
 */
export async function hybridSearch(
  supabase: SupabaseClient,
  query: SearchQuery
): Promise<SearchResult[]> {
  try {
    const {
      query: searchQuery,
      category_id,
      tags,
      published_only = true,
      organization_id,
      limit = 50,
      offset = 0,
    } = query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    // Generate query embedding for vector search
    const queryEmbedding = await generateQueryEmbedding(supabase, searchQuery);

    // Build base query
    let articlesQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `);

    // Apply filters
    if (published_only) {
      articlesQuery = articlesQuery.eq('published', true);
    }

    if (category_id) {
      articlesQuery = articlesQuery.eq('category_id', category_id);
    }

    if (tags && tags.length > 0) {
      articlesQuery = articlesQuery.contains('tags', tags);
    }

    if (organization_id !== undefined) {
      if (organization_id === null) {
        // Global docs only
        articlesQuery = articlesQuery.is('organization_id', null);
      } else {
        // Org docs or global docs
        articlesQuery = articlesQuery.or(`organization_id.eq.${organization_id},organization_id.is.null`);
      }
    }

    // Perform full-text search
    const fulltextResults = await performFullTextSearch(
      supabase,
      articlesQuery,
      searchQuery,
      limit * 2 // Get more results for ranking
    );

    // Perform vector similarity search if embedding available
    let vectorResults: SearchResult[] = [];
    if (queryEmbedding) {
      vectorResults = await performVectorSearch(
        supabase,
        articlesQuery,
        queryEmbedding,
        limit * 2
      );
    }

    // Merge and rank results
    const mergedResults = mergeSearchResults(fulltextResults, vectorResults, searchQuery);

    // Apply pagination
    return mergedResults.slice(offset, offset + limit);
  } catch (error) {
    logger.error('[KB Search] Error in hybrid search:', error);
    return [];
  }
}

/**
 * Perform full-text search using PostgreSQL tsvector
 * @param supabase - Supabase client instance
 * @param baseQuery - Base query with filters applied
 * @param searchQuery - Search query text
 * @param limit - Maximum number of results
 * @returns Array of search results
 */
async function performFullTextSearch(
  supabase: SupabaseClient,
  baseQuery: QueryBuilder,
  searchQuery: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // Use PostgreSQL full-text search
    // Search in title, summary, and body
    const searchTerms = searchQuery
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => term.trim())
      .join(' & ');

    const { data, error } = await baseQuery
      .textSearch('search_vector', searchTerms, {
        type: 'websearch',
        config: 'english',
      })
      .limit(limit);

    if (error) {
      logger.error('[KB Search] Full-text search error:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Calculate relevance scores based on rank
    return data.map((article: KnowledgeBaseArticleWithCategory, index: number) => ({
      article,
      relevance_score: calculateFullTextScore(article, searchQuery, index),
      match_type: 'fulltext' as const,
    }));
  } catch (error) {
    logger.error('[KB Search] Exception in full-text search:', error);
    return [];
  }
}

/**
 * Perform vector similarity search using pgvector
 * @param supabase - Supabase client instance
 * @param baseQuery - Base query with filters applied
 * @param queryEmbedding - Query embedding vector
 * @param limit - Maximum number of results
 * @returns Array of search results
 */
async function performVectorSearch(
  supabase: SupabaseClient,
  baseQuery: QueryBuilder,
  queryEmbedding: number[],
  limit: number
): Promise<SearchResult[]> {
  try {
    // For vector search, we need to use RPC or raw SQL
    // Since Supabase query builder doesn't support vector operators directly,
    // we'll use a workaround: fetch all matching articles and calculate similarity in JS
    // For production, consider creating an RPC function in Supabase
    
    const { data: articles, error } = await baseQuery
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .not('vector', 'is', null)
      .limit(limit * 3); // Fetch more to account for filtering

    if (error) {
      logger.error('[KB Search] Vector search error:', error);
      return [];
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    // Calculate cosine similarity for each article
    const results = (articles as ArticleWithVector[])
      .map((article): SearchResult | null => {
        if (!article.vector) {
          return null;
        }

        // Convert vector to array if it's a string (Supabase may return pgvector as string)
        let vectorArray: number[];
        if (typeof article.vector === 'string') {
          try {
            vectorArray = JSON.parse(article.vector);
          } catch (parseError) {
            logger.warn('[KB Search] Failed to parse vector string:', { id: article.id, error: parseError });
            return null;
          }
        } else if (Array.isArray(article.vector)) {
          vectorArray = article.vector;
        } else {
          return null;
        }

        if (!Array.isArray(vectorArray) || vectorArray.length === 0) {
          return null;
        }

        const similarity = cosineSimilarity(queryEmbedding, vectorArray);
        return {
          article: article as KnowledgeBaseArticleWithCategory,
          relevance_score: similarity,
          match_type: 'vector' as const,
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);

    return results;
  } catch (error) {
    logger.error('[KB Search] Exception in vector search:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Calculate full-text search relevance score
 * @param article - Article data
 * @param searchQuery - Search query
 * @param rank - Result rank (lower is better)
 * @returns Relevance score (0-1)
 */
function calculateFullTextScore(
  article: KnowledgeBaseArticleWithCategory,
  searchQuery: string,
  rank: number
): number {
  const queryLower = searchQuery.toLowerCase();
  const titleLower = article.title.toLowerCase();
  const summaryLower = article.summary?.toLowerCase() || '';
  const bodyLower = article.body.toLowerCase();

  let score = 0;

  // Title matches are most important
  if (titleLower.includes(queryLower)) {
    score += 0.5;
  } else {
    const titleWords = queryLower.split(/\s+/);
    const titleMatches = titleWords.filter(word => titleLower.includes(word)).length;
    score += (titleMatches / titleWords.length) * 0.3;
  }

  // Summary matches
  if (summaryLower.includes(queryLower)) {
    score += 0.3;
  }

  // Body matches
  if (bodyLower.includes(queryLower)) {
    score += 0.2;
  } else {
    const bodyWords = queryLower.split(/\s+/);
    const bodyMatches = bodyWords.filter(word => bodyLower.includes(word)).length;
    score += (bodyMatches / bodyWords.length) * 0.1;
  }

  // Apply rank penalty (lower rank = higher score)
  const rankPenalty = Math.max(0, 1 - rank / 100);
  score *= rankPenalty;

  return Math.min(1, score);
}

/**
 * Merge and rank search results from full-text and vector search
 * @param fulltextResults - Full-text search results
 * @param vectorResults - Vector search results
 * @param searchQuery - Original search query
 * @returns Merged and ranked results
 */
function mergeSearchResults(
  fulltextResults: SearchResult[],
  vectorResults: SearchResult[],
  searchQuery: string
): SearchResult[] {
  // Create a map of article IDs to results
  const resultMap = new Map<string, SearchResult>();

  // Add full-text results
  fulltextResults.forEach(result => {
    resultMap.set(result.article.id, {
      ...result,
      match_type: 'fulltext',
    });
  });

  // Merge vector results
  vectorResults.forEach(result => {
    const existing = resultMap.get(result.article.id);

    if (existing) {
      // Article found in both searches - combine scores
      const combinedScore = (existing.relevance_score * 0.4) + (result.relevance_score * 0.6);
      resultMap.set(result.article.id, {
        ...result,
        relevance_score: combinedScore,
        match_type: 'both',
      });
    } else {
      // Only in vector search
      resultMap.set(result.article.id, result);
    }
  });

  // Convert to array and sort by relevance score
  const merged = Array.from(resultMap.values());
  merged.sort((a, b) => b.relevance_score - a.relevance_score);

  return merged;
}

/**
 * Simple full-text search (fallback when embeddings unavailable)
 * @param supabase - Supabase client instance
 * @param query - Search query parameters
 * @returns Array of articles
 */
export async function simpleSearch(
  supabase: SupabaseClient,
  query: SearchQuery
): Promise<KnowledgeBaseArticleWithCategory[]> {
  try {
    const {
      query: searchQuery,
      category_id,
      tags,
      published_only = true,
      organization_id,
      limit = 50,
      offset = 0,
    } = query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    let articlesQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `);

    if (published_only) {
      articlesQuery = articlesQuery.eq('published', true);
    }

    if (category_id) {
      articlesQuery = articlesQuery.eq('category_id', category_id);
    }

    if (tags && tags.length > 0) {
      articlesQuery = articlesQuery.contains('tags', tags);
    }

    if (organization_id !== undefined) {
      if (organization_id === null) {
        articlesQuery = articlesQuery.is('organization_id', null);
      } else {
        articlesQuery = articlesQuery.or(`organization_id.eq.${organization_id},organization_id.is.null`);
      }
    }

    // Use search_vector for full-text search
    const searchTerms = searchQuery
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => term.trim())
      .join(' & ');

    const { data, error } = await articlesQuery
      .textSearch('search_vector', searchTerms, {
        type: 'websearch',
        config: 'english',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[KB Search] Simple search error:', error);
      return [];
    }

    return (data || []) as KnowledgeBaseArticleWithCategory[];
  } catch (error) {
    logger.error('[KB Search] Exception in simple search:', error);
    return [];
  }
}

