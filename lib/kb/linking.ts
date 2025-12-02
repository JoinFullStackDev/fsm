/**
 * Knowledge Base Auto-Linking Utility
 * Identifies and links related content (articles, tasks, dashboards, phases)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import { generateArticleEmbedding } from './embeddings';
import type { RelatedContent, KnowledgeBaseArticle } from '@/types/kb';

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
 * Find related articles using semantic similarity
 * @param supabase - Supabase client instance
 * @param articleId - Article ID to find related content for
 * @param limit - Maximum number of related articles (default: 5)
 * @returns Array of related articles with similarity scores
 */
export async function findRelatedArticles(
  supabase: SupabaseClient,
  articleId: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  title: string;
  slug: string;
  similarity_score: number;
}>> {
  try {
    // Get the source article
    const { data: sourceArticle, error: articleError } = await supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !sourceArticle) {
      logger.error('[KB Linking] Error fetching source article:', articleError);
      return [];
    }

    // Get article's embedding
    if (!sourceArticle.vector) {
      logger.warn('[KB Linking] Source article has no embedding, cannot find related articles');
      return [];
    }

    // Convert vector to array if it's a string
    let sourceEmbedding: number[];
    if (typeof sourceArticle.vector === 'string') {
      // Parse PostgreSQL vector format: '[0.1,0.2,0.3]'
      sourceEmbedding = JSON.parse(sourceArticle.vector);
    } else if (Array.isArray(sourceArticle.vector)) {
      sourceEmbedding = sourceArticle.vector;
    } else {
      logger.error('[KB Linking] Invalid vector format');
      return [];
    }

    const vectorString = '[' + sourceEmbedding.join(',') + ']';

    // Find similar articles using vector similarity
    const { data: allArticles, error: searchError } = await supabase
      .from('knowledge_base_articles')
      .select('id, title, slug, organization_id, vector')
      .eq('published', true)
      .neq('id', articleId)
      .not('vector', 'is', null)
      .limit(limit * 3); // Fetch more to calculate similarity

    if (searchError) {
      logger.error('[KB Linking] Error finding similar articles:', searchError);
      return [];
    }

    if (!allArticles || allArticles.length === 0) {
      return [];
    }

    // Filter by organization (include global docs)
    const sourceOrgId = sourceArticle.organization_id;
    const filtered = allArticles.filter((item: any) => {
      if (sourceOrgId === null) {
        // Global article - only show global articles
        return item.organization_id === null;
      } else {
        // Org article - show org articles and global articles
        return item.organization_id === sourceOrgId || item.organization_id === null;
      }
    });

    // Calculate cosine similarity for each article
    const similarArticles = filtered
      .map((item: any) => {
        if (!item.vector || !Array.isArray(item.vector)) {
          return null;
        }
        // Convert item vector to array if needed
        let itemVector: number[];
        if (typeof item.vector === 'string') {
          itemVector = JSON.parse(item.vector);
        } else if (Array.isArray(item.vector)) {
          itemVector = item.vector;
        } else {
          return null;
        }
        const similarity = cosineSimilarity(sourceEmbedding, itemVector);
        return { ...item, similarity };
      })
      .filter((r: any) => r !== null)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit);

    // Format results
    return similarArticles.map((item: any) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      similarity_score: item.similarity,
    }));
  } catch (error) {
    logger.error('[KB Linking] Exception finding related articles:', error);
    return [];
  }
}

/**
 * Find related tasks based on article content
 * Uses keyword matching and semantic similarity
 * @param supabase - Supabase client instance
 * @param article - Article data
 * @param organizationId - Organization ID
 * @param limit - Maximum number of related tasks (default: 5)
 * @returns Array of related tasks
 */
export async function findRelatedTasks(
  supabase: SupabaseClient,
  article: KnowledgeBaseArticle,
  organizationId: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  title: string;
  project_id: string;
  project_name?: string;
  matching_keywords?: string[];
}>> {
  try {
    // Extract keywords from article title and summary
    const keywords = extractKeywords(article.title + ' ' + (article.summary || ''));

    if (keywords.length === 0) {
      return [];
    }

    // Get project IDs and names for the organization
    const { data: orgProjects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', organizationId);
    
    const projectIds = orgProjects?.map(p => p.id) || [];
    const projectMap = new Map(orgProjects?.map(p => [p.id, p.name]) || []);
    
    if (projectIds.length === 0) {
      return [];
    }

    // Search for tasks with matching keywords
    const { data: tasks, error } = await supabase
      .from('project_tasks')
      .select('id, title, project_id, description')
      .in('project_id', projectIds)
      .limit(limit * 2); // Get more to filter and find matches

    if (error) {
      logger.error('[KB Linking] Error finding related tasks:', error);
      return [];
    }

    // Filter tasks that contain keywords and find matching keywords
    const relatedTasks = (tasks || [])
      .map((task: any) => {
        const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
        const matchingKeywords = keywords.filter(kw => 
          taskText.includes(kw.toLowerCase())
        );
        return { task, matchingKeywords };
      })
      .filter(({ matchingKeywords }) => matchingKeywords.length > 0)
      .sort((a, b) => b.matchingKeywords.length - a.matchingKeywords.length) // Sort by number of matches
      .slice(0, limit)
      .map(({ task, matchingKeywords }) => ({
        id: task.id,
        title: task.title,
        project_id: task.project_id,
        project_name: projectMap.get(task.project_id) || undefined,
        matching_keywords: matchingKeywords.slice(0, 3), // Show up to 3 matching keywords
      }));

    return relatedTasks;
  } catch (error) {
    logger.error('[KB Linking] Exception finding related tasks:', error);
    return [];
  }
}

/**
 * Find related dashboards based on article content
 * @param supabase - Supabase client instance
 * @param article - Article data
 * @param organizationId - Organization ID
 * @param limit - Maximum number of related dashboards (default: 3)
 * @returns Array of related dashboards
 */
export async function findRelatedDashboards(
  supabase: SupabaseClient,
  article: KnowledgeBaseArticle,
  organizationId: string,
  limit: number = 3
): Promise<Array<{
  id: string;
  name: string;
}>> {
  try {
    const keywords = extractKeywords(article.title + ' ' + (article.summary || ''));

    if (keywords.length === 0) {
      return [];
    }

    const { data: dashboards, error } = await supabase
      .from('dashboards')
      .select('id, name')
      .eq('organization_id', organizationId)
      .or(keywords.map(kw => `name.ilike.%${kw}%,description.ilike.%${kw}%`).join(','))
      .limit(limit);

    if (error) {
      logger.error('[KB Linking] Error finding related dashboards:', error);
      return [];
    }

    return (dashboards || []).map((dashboard: any) => ({
      id: dashboard.id,
      name: dashboard.name,
    }));
  } catch (error) {
    logger.error('[KB Linking] Exception finding related dashboards:', error);
    return [];
  }
}

/**
 * Find related phases based on article content
 * @param supabase - Supabase client instance
 * @param article - Article data
 * @param organizationId - Organization ID
 * @param limit - Maximum number of related phases (default: 5)
 * @returns Array of related phases
 */
export async function findRelatedPhases(
  supabase: SupabaseClient,
  article: KnowledgeBaseArticle,
  organizationId: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  project_id: string;
  phase_number: number;
  phase_name?: string;
  project_name?: string;
  matching_keywords?: string[];
}>> {
  try {
    // Get projects for the organization
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', organizationId);

    if (!projects || projects.length === 0) {
      return [];
    }

    const projectIds = projects.map(p => p.id);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const keywords = extractKeywords(article.title + ' ' + (article.summary || ''));

    if (keywords.length === 0) {
      return [];
    }

    // Search phases by project and keywords in phase data
    const { data: phases, error } = await supabase
      .from('project_phases')
      .select('id, project_id, phase_number, phase_name, data')
      .in('project_id', projectIds)
      .limit(limit * 2); // Get more to filter by keyword match

    if (error) {
      logger.error('[KB Linking] Error finding related phases:', error);
      return [];
    }

    // Filter phases that contain keywords in their data and find matching keywords
    const relatedPhases = (phases || [])
      .map((phase: any) => {
        const phaseData = JSON.stringify(phase.data || {}).toLowerCase();
        const matchingKeywords = keywords.filter(kw => 
          phaseData.includes(kw.toLowerCase())
        );
        return { phase, matchingKeywords };
      })
      .filter(({ matchingKeywords }) => matchingKeywords.length > 0)
      .sort((a, b) => b.matchingKeywords.length - a.matchingKeywords.length) // Sort by number of matches
      .slice(0, limit)
      .map(({ phase, matchingKeywords }) => ({
        id: phase.id,
        project_id: phase.project_id,
        phase_number: phase.phase_number,
        phase_name: phase.phase_name || undefined,
        project_name: projectMap.get(phase.project_id) || undefined,
        matching_keywords: matchingKeywords.slice(0, 3), // Show up to 3 matching keywords
      }));

    return relatedPhases;
  } catch (error) {
    logger.error('[KB Linking] Exception finding related phases:', error);
    return [];
  }
}

/**
 * Find all related content for an article
 * @param supabase - Supabase client instance
 * @param articleId - Article ID
 * @param organizationId - Organization ID
 * @returns RelatedContent object with all related items
 */
export async function findAllRelatedContent(
  supabase: SupabaseClient,
  articleId: string,
  organizationId: string | null
): Promise<RelatedContent> {
  try {
    // Get article
    const { data: article, error: articleError } = await supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      logger.error('[KB Linking] Error fetching article:', articleError);
      return { articles: [] };
    }

    // Find related articles
    const relatedArticles = await findRelatedArticles(supabase, articleId, 5);

    // Find related tasks, dashboards, and phases if organization ID is available
    let relatedTasks: Array<{ id: string; title: string; project_id: string; project_name?: string; matching_keywords?: string[] }> = [];
    let relatedDashboards: Array<{ id: string; name: string }> = [];
    let relatedPhases: Array<{ id: string; project_id: string; phase_number: number; phase_name?: string; project_name?: string; matching_keywords?: string[] }> = [];

    if (organizationId) {
      [relatedTasks, relatedDashboards, relatedPhases] = await Promise.all([
        findRelatedTasks(supabase, article, organizationId, 5),
        findRelatedDashboards(supabase, article, organizationId, 3),
        findRelatedPhases(supabase, article, organizationId, 5),
      ]);
    }

    return {
      articles: relatedArticles,
      tasks: relatedTasks.length > 0 ? relatedTasks : undefined,
      dashboards: relatedDashboards.length > 0 ? relatedDashboards : undefined,
      phases: relatedPhases.length > 0 ? relatedPhases : undefined,
    };
  } catch (error) {
    logger.error('[KB Linking] Exception finding all related content:', error);
    return { articles: [] };
  }
}

/**
 * Update article metadata with related content links
 * @param supabase - Supabase client instance
 * @param articleId - Article ID
 * @param relatedContent - Related content to store
 * @returns True if successful
 */
export async function updateArticleLinks(
  supabase: SupabaseClient,
  articleId: string,
  relatedContent: RelatedContent
): Promise<boolean> {
  try {
    // Get current article metadata
    const { data: article, error: fetchError } = await supabase
      .from('knowledge_base_articles')
      .select('metadata')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      logger.error('[KB Linking] Error fetching article for link update:', fetchError);
      return false;
    }

    // Update metadata with related content
    const updatedMetadata = {
      ...article.metadata,
      related_articles: relatedContent.articles.map(a => a.id),
      related_tasks: relatedContent.tasks?.map(t => t.id) || [],
      related_dashboards: relatedContent.dashboards?.map(d => d.id) || [],
      related_phases: relatedContent.phases?.map(p => p.id) || [],
    };

    const { error: updateError } = await supabase
      .from('knowledge_base_articles')
      .update({ metadata: updatedMetadata })
      .eq('id', articleId);

    if (updateError) {
      logger.error('[KB Linking] Error updating article links:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[KB Linking] Exception updating article links:', error);
    return false;
  }
}

/**
 * Extract keywords from text
 * @param text - Text to extract keywords from
 * @returns Array of keywords (max 10)
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words and extract meaningful terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));

  // Get unique words and limit to 10
  const uniqueWords = Array.from(new Set(words)).slice(0, 10);

  return uniqueWords;
}

