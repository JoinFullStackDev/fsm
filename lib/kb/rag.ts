/**
 * Knowledge Base RAG (Retrieval-Augmented Generation) Utility
 * Handles semantic search and context building for AI Q&A
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import { generateQueryEmbedding } from './embeddings';
import type { KnowledgeBaseArticleWithCategory } from '@/types/kb';

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

export interface RAGContext {
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    body: string;
    relevance_score: number;
  }>;
  context_text: string;
}

/**
 * Retrieve relevant articles for RAG using semantic search
 * @param supabase - Supabase client instance
 * @param query - User query
 * @param organizationId - Organization ID (null for global docs)
 * @param topK - Number of articles to retrieve (default: 5)
 * @returns Array of relevant articles with relevance scores
 */
export async function retrieveRelevantArticles(
  supabase: SupabaseClient,
  query: string,
  organizationId: string | null = null,
  topK: number = 5
): Promise<Array<{
  article: KnowledgeBaseArticleWithCategory;
  relevance_score: number;
}>> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(supabase, query);

    if (!queryEmbedding) {
      logger.warn('[KB RAG] Failed to generate query embedding, falling back to full-text search');
      return await retrieveRelevantArticlesFullText(supabase, query, organizationId, topK);
    }

    // Build query for vector similarity search
    let articlesQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('published', true)
      .not('vector', 'is', null);

    // Filter by organization (include global docs)
    if (organizationId !== null) {
      articlesQuery = articlesQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      articlesQuery = articlesQuery.is('organization_id', null);
    }

    // Fetch articles and calculate similarity in JavaScript
    // (Supabase query builder doesn't support vector operators directly)
    const { data, error } = await articlesQuery
      .select(`*, category:knowledge_base_categories(*)`)
      .limit(topK * 3); // Fetch more to account for filtering

    if (error) {
      logger.error('[KB RAG] Vector search error:', { error, organizationId, query });
      return await retrieveRelevantArticlesFullText(supabase, query, organizationId, topK);
    }

    if (!data || data.length === 0) {
      // No articles with embeddings found - fall back to full-text search
      logger.warn('[KB RAG] No articles with embeddings found', { 
        organizationId, 
        query,
        filter: organizationId !== null ? `org=${organizationId} or global` : 'global only'
      });
      return await retrieveRelevantArticlesFullText(supabase, query, organizationId, topK);
    }

    logger.debug('[KB RAG] Found articles with embeddings:', { 
      count: data.length, 
      organizationId,
      sampleTitles: data.slice(0, 3).map((a: any) => a.title)
    });

    // Calculate cosine similarity for each article
    const results = data
      .map((item: any) => {
        if (!item.vector) {
          logger.debug('[KB RAG] Article missing vector:', { id: item.id, title: item.title });
          return null;
        }

        // Convert vector to array if it's a string (Supabase may return pgvector as string)
        let vectorArray: number[];
        if (typeof item.vector === 'string') {
          try {
            // Parse string like "[0.1,0.2,0.3]" to array
            vectorArray = JSON.parse(item.vector);
          } catch (parseError) {
            logger.warn('[KB RAG] Failed to parse vector string:', { id: item.id, title: item.title, error: parseError });
            return null;
          }
        } else if (Array.isArray(item.vector)) {
          vectorArray = item.vector;
        } else {
          logger.warn('[KB RAG] Vector is not string or array:', { id: item.id, title: item.title, vectorType: typeof item.vector });
          return null;
        }

        if (!Array.isArray(vectorArray) || vectorArray.length === 0) {
          logger.warn('[KB RAG] Invalid vector array:', { id: item.id, title: item.title, vectorLength: vectorArray?.length });
          return null;
        }

        const similarity = cosineSimilarity(queryEmbedding, vectorArray);
        logger.debug('[KB RAG] Article similarity:', { id: item.id, title: item.title, similarity, vectorLength: vectorArray.length });
        return {
          article: item as KnowledgeBaseArticleWithCategory,
          relevance_score: similarity,
        };
      })
      .filter((r: any) => r !== null)
      .filter((r: any): r is { article: any; relevance_score: number } => r !== null)
      .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
      .slice(0, topK);

    logger.debug('[KB RAG] Vector search results:', { 
      totalArticles: data.length, 
      resultsCount: results.length,
      topScores: results.slice(0, 3).map(r => ({ title: r.article.title, score: r.relevance_score }))
    });

    // If no results from vector search, fall back to full-text
    if (results.length === 0) {
      logger.warn('[KB RAG] No articles found with vector search, falling back to full-text search');
      return await retrieveRelevantArticlesFullText(supabase, query, organizationId, topK);
    }

    return results;
  } catch (error) {
    logger.error('[KB RAG] Error retrieving relevant articles:', error);
    return [];
  }
}

/**
 * Retrieve relevant articles using full-text search (fallback)
 * @param supabase - Supabase client instance
 * @param query - User query
 * @param organizationId - Organization ID (null for global docs)
 * @param topK - Number of articles to retrieve
 * @returns Array of relevant articles with relevance scores
 */
async function retrieveRelevantArticlesFullText(
  supabase: SupabaseClient,
  query: string,
  organizationId: string | null,
  topK: number
): Promise<Array<{
  article: KnowledgeBaseArticleWithCategory;
  relevance_score: number;
}>> {
  try {
    let articlesQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('published', true);

    if (organizationId !== null) {
      articlesQuery = articlesQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      articlesQuery = articlesQuery.is('organization_id', null);
    }

    // Try full-text search first (if search_vector column exists)
    let data: any[] | null = null;
    let error: any = null;

    try {
      const searchTerms = query
        .split(/\s+/)
        .filter(term => term.length > 0)
        .map(term => term.trim())
        .join(' & ');

      const searchResult = await articlesQuery
        .textSearch('search_vector', searchTerms, {
          type: 'websearch',
          config: 'english',
        })
        .limit(topK);

      data = searchResult.data;
      error = searchResult.error;
    } catch (textSearchError) {
      logger.warn('[KB RAG] Full-text search failed, using simple text matching:', textSearchError);
      error = textSearchError;
    }

    // If full-text search failed, use simple text matching
    if (error || !data || data.length === 0) {
      logger.debug('[KB RAG] Falling back to simple text matching', { error, dataLength: data?.length });
      
      // Rebuild query without textSearch
      let simpleQuery = supabase
        .from('knowledge_base_articles')
        .select(`
          *,
          category:knowledge_base_categories(*)
        `)
        .eq('published', true);

      if (organizationId !== null) {
        simpleQuery = simpleQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      } else {
        simpleQuery = simpleQuery.is('organization_id', null);
      }

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2); // Ignore very short words

      const { data: allArticles, error: fetchError } = await simpleQuery.limit(100);
      
      logger.debug('[KB RAG] Simple search fetched articles:', { 
        count: allArticles?.length, 
        error: fetchError,
        organizationId,
        query
      });

      if (fetchError) {
        logger.error('[KB RAG] Error fetching articles for simple search:', { 
          error: fetchError, 
          organizationId,
          query 
        });
        return [];
      }

      if (!allArticles || allArticles.length === 0) {
        logger.warn('[KB RAG] No articles found for simple search', { 
          organizationId,
          query,
          filter: organizationId !== null ? `org=${organizationId} or global` : 'global only'
        });
        return [];
      }

          // Filter articles that contain query terms
          const matchingArticles = allArticles
            .map((article: any) => {
              const titleLower = article.title?.toLowerCase() || '';
              const summaryLower = article.summary?.toLowerCase() || '';
              const bodyLower = article.body?.toLowerCase() || '';
              const combinedText = `${titleLower} ${summaryLower} ${bodyLower}`;

              // Count how many query words match
              let matchCount = 0;
              let titleMatches = 0;
              let summaryMatches = 0;
              let bodyMatches = 0;
              
              for (const word of queryWords) {
                if (combinedText.includes(word)) {
                  matchCount++;
                  if (titleLower.includes(word)) titleMatches++;
                  if (summaryLower.includes(word)) summaryMatches++;
                  if (bodyLower.includes(word)) bodyMatches++;
                }
              }

              if (matchCount === 0) {
                return null;
              }

              // Calculate score based on where matches occur and word match ratio
              let score = 0;
              
              // Base score from word match ratio (0-0.4)
              const wordMatchRatio = matchCount / queryWords.length;
              score += wordMatchRatio * 0.4;
              
              // Boost for matches in title (0-0.3)
              if (titleMatches > 0) {
                score += Math.min(0.3, (titleMatches / queryWords.length) * 0.3);
              }
              
              // Boost for matches in summary (0-0.2)
              if (summaryMatches > 0) {
                score += Math.min(0.2, (summaryMatches / queryWords.length) * 0.2);
              }
              
              // Boost for matches in body (0-0.1)
              if (bodyMatches > 0) {
                score += Math.min(0.1, (bodyMatches / queryWords.length) * 0.1);
              }
              
              // Bonus if entire query phrase appears (exact match)
              if (titleLower.includes(queryLower)) score += 0.2;
              else if (summaryLower.includes(queryLower)) score += 0.15;
              else if (bodyLower.includes(queryLower)) score += 0.1;

              return {
                article: article as KnowledgeBaseArticleWithCategory,
                relevance_score: Math.min(1, score),
              };
            })
            .filter((r: any): r is { article: KnowledgeBaseArticleWithCategory; relevance_score: number } => r !== null)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, topK);

      logger.debug('[KB RAG] Simple text matching results:', { 
        totalArticles: allArticles.length,
        resultsCount: matchingArticles.length,
        topScores: matchingArticles.slice(0, 3).map(r => ({ title: r.article.title, score: r.relevance_score }))
      });

      return matchingArticles;
    }

    // Calculate relevance scores based on match quality
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    return data.map((article: KnowledgeBaseArticleWithCategory, index: number) => {
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary?.toLowerCase() || '';
      const bodyLower = article.body.toLowerCase();
      const combinedText = `${titleLower} ${summaryLower} ${bodyLower}`;

      // Count word matches
      let matchCount = 0;
      let titleMatches = 0;
      let summaryMatches = 0;
      let bodyMatches = 0;
      
      for (const word of queryWords) {
        if (combinedText.includes(word)) {
          matchCount++;
          if (titleLower.includes(word)) titleMatches++;
          if (summaryLower.includes(word)) summaryMatches++;
          if (bodyLower.includes(word)) bodyMatches++;
        }
      }

      let score = 0;
      
      // Base score from word match ratio (0-0.4)
      if (queryWords.length > 0) {
        const wordMatchRatio = matchCount / queryWords.length;
        score += wordMatchRatio * 0.4;
      }
      
      // Boost for matches in title (0-0.3)
      if (titleMatches > 0 && queryWords.length > 0) {
        score += Math.min(0.3, (titleMatches / queryWords.length) * 0.3);
      }
      
      // Boost for matches in summary (0-0.2)
      if (summaryMatches > 0 && queryWords.length > 0) {
        score += Math.min(0.2, (summaryMatches / queryWords.length) * 0.2);
      }
      
      // Boost for matches in body (0-0.1)
      if (bodyMatches > 0 && queryWords.length > 0) {
        score += Math.min(0.1, (bodyMatches / queryWords.length) * 0.1);
      }
      
      // Bonus if entire query phrase appears (exact match)
      if (titleLower.includes(queryLower)) score += 0.2;
      else if (summaryLower.includes(queryLower)) score += 0.15;
      else if (bodyLower.includes(queryLower)) score += 0.1;

      // Apply rank penalty (less aggressive)
      score *= Math.max(0.5, 1 - index / 20);

      return {
        article,
        relevance_score: Math.min(1, Math.max(0.1, score)), // Ensure minimum 10% score if matched
      };
    });
  } catch (error) {
    logger.error('[KB RAG] Error in full-text retrieval:', error);
    return [];
  }
}

/**
 * Build RAG context from retrieved articles
 * @param retrievedArticles - Articles retrieved from semantic search
 * @param maxContextLength - Maximum context length in characters (default: 8000)
 * @returns RAG context object
 */
export function buildRAGContext(
  retrievedArticles: Array<{
    article: KnowledgeBaseArticleWithCategory;
    relevance_score: number;
  }>,
  maxContextLength: number = 8000
): RAGContext {
  const contextParts: string[] = [];
  let currentLength = 0;

  // Sort by relevance score (highest first)
  const sortedArticles = [...retrievedArticles].sort(
    (a, b) => b.relevance_score - a.relevance_score
  );

  for (const { article, relevance_score } of sortedArticles) {
    if (currentLength >= maxContextLength) {
      break;
    }

    // Build article context
    const articleContext = [
      `## ${article.title}`,
      article.summary ? `Summary: ${article.summary}` : '',
      `Content: ${article.body.substring(0, Math.min(article.body.length, maxContextLength - currentLength - 200))}`,
      `---`,
    ]
      .filter(part => part.length > 0)
      .join('\n\n');

    const articleLength = articleContext.length;

    if (currentLength + articleLength <= maxContextLength) {
      contextParts.push(articleContext);
      currentLength += articleLength;
    } else {
      // Truncate last article to fit
      const remaining = maxContextLength - currentLength;
      if (remaining > 100) {
        const truncated = articleContext.substring(0, remaining - 50) + '...';
        contextParts.push(truncated);
      }
      break;
    }
  }

  const context_text = contextParts.join('\n\n');

  return {
    articles: sortedArticles.map(({ article, relevance_score }) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      body: article.body,
      relevance_score,
    })),
    context_text,
  };
}

/**
 * Build RAG prompt for AI Q&A
 * @param userQuery - User's question
 * @param context - RAG context from retrieved articles
 * @param systemInstructions - Optional system instructions
 * @returns Complete prompt for AI
 */
export function buildRAGPrompt(
  userQuery: string,
  context: RAGContext,
  systemInstructions?: string
): string {
  const defaultInstructions = `You are a helpful assistant that answers questions based solely on the provided knowledge base articles. 
- Only use information from the provided context
- If the context doesn't contain enough information to answer the question, say so
- Cite specific articles when referencing information
- Be concise but thorough
- Format your response in clear, readable markdown`;

  const instructions = systemInstructions || defaultInstructions;

  return `${instructions}

## Knowledge Base Context

${context.context_text}

## User Question

${userQuery}

## Your Response

Please answer the user's question using only the information provided in the knowledge base context above. If the context doesn't contain enough information, please say so.`;
}

/**
 * Extract source citations from RAG context
 * @param context - RAG context
 * @returns Array of source citations
 */
export function extractSources(context: RAGContext): Array<{
  article_id: string;
  article_title: string;
  article_slug: string;
  relevance_score: number;
}> {
  return context.articles.map(article => ({
    article_id: article.id,
    article_title: article.title,
    article_slug: article.slug,
    relevance_score: article.relevance_score,
  }));
}

