/**
 * Knowledge Base Type Definitions
 */

export interface KnowledgeBaseCategory {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseCategoryWithChildren extends KnowledgeBaseCategory {
  children?: KnowledgeBaseCategoryWithChildren[];
  article_count?: number;
}

export interface KnowledgeBaseArticle {
  id: string;
  organization_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  tags: string[];
  category_id: string | null;
  metadata: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    reading_time?: number; // in minutes
    related_articles?: string[];
    related_tasks?: string[];
    related_dashboards?: string[];
    related_phases?: string[];
    [key: string]: any;
  };
  vector: number[] | null; // pgvector embedding
  published: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseArticleWithCategory extends KnowledgeBaseArticle {
  category?: KnowledgeBaseCategory | null;
}

export interface KnowledgeBaseVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface KnowledgeBaseAnalytics {
  id: string;
  article_id: string | null;
  user_id: string | null;
  action_type: 'view' | 'search' | 'ai_query' | 'helpful' | 'unhelpful' | 'export';
  metadata: {
    query?: string;
    search_results_count?: number;
    ai_model?: string;
    export_type?: 'pdf' | 'zip';
    [key: string]: any;
  };
  created_at: string;
}

export interface ArticleCreateInput {
  title: string;
  slug?: string;
  summary?: string;
  body: string;
  tags?: string[];
  category_id?: string | null;
  metadata?: Record<string, any>;
  published?: boolean;
}

export interface ArticleUpdateInput {
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  category_id?: string | null;
  metadata?: Record<string, any>;
  published?: boolean;
}

export interface CategoryCreateInput {
  name: string;
  slug?: string;
  parent_id?: string | null;
}

export interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  parent_id?: string | null;
}

export interface SearchQuery {
  query: string;
  category_id?: string | null;
  tags?: string[];
  published_only?: boolean;
  organization_id?: string | null;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  article: KnowledgeBaseArticleWithCategory;
  relevance_score: number;
  match_type: 'fulltext' | 'vector' | 'both';
}

export interface AIGenerateArticleInput {
  prompt: string;
  context?: string;
  category_id?: string | null;
  tags?: string[];
}

export interface AIGenerateArticleOutput {
  title: string;
  summary: string;
  body: string;
  tags: string[];
  category_suggestions: Array<{
    id: string;
    name: string;
    confidence: number;
  }>;
  metadata: {
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimated_reading_time: number;
  };
}

export interface AISummarizeInput {
  article_id: string;
}

export interface AISummarizeOutput {
  summary: string;
  tldr: string;
  reading_time: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  key_points: string[];
}

export interface AIRewriteInput {
  article_id: string;
  style: 'clarity' | 'step-by-step' | 'developer-friendly';
}

export interface AIRewriteOutput {
  body: string;
  changes_summary: string;
}

export interface AIGenerateFAQInput {
  article_id: string;
  num_questions?: number;
}

export interface AIGenerateFAQOutput {
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}

export interface AIChatInput {
  query: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  organization_id?: string | null;
}

export interface AIChatOutput {
  answer: string;
  sources: Array<{
    article_id: string;
    article_title: string;
    article_slug: string;
    relevance_score: number;
  }>;
  metadata: {
    model: string;
    tokens_used: number;
    response_time_ms: number;
  };
}

export interface RelatedContent {
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    similarity_score: number;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    project_id: string;
  }>;
  dashboards?: Array<{
    id: string;
    name: string;
  }>;
  phases?: Array<{
    id: string;
    project_id: string;
    phase_number: number;
  }>;
}

export interface AnalyticsStats {
  total_views: number;
  total_searches: number;
  total_ai_queries: number;
  helpful_ratings: number;
  unhelpful_ratings: number;
  total_exports: number;
  top_articles: Array<{
    article_id: string;
    article_title: string;
    views: number;
  }>;
  search_queries: Array<{
    query: string;
    count: number;
  }>;
  period: {
    start: string;
    end: string;
  };
}

