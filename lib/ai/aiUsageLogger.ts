import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIResponseWithMetadata } from './geminiClient';
import logger from '@/lib/utils/logger';

export type AIFeatureType = 
  | 'ai_generate'           // Generic AI generation
  | 'project_analyze'       // Project analysis/task generation
  | 'dashboard_insights'    // Dashboard AI insights
  | 'kb_summarize'          // KB article summarization
  | 'kb_rewrite'            // KB article rewriting
  | 'kb_faq'                // KB FAQ generation
  | 'kb_chat'               // KB RAG chat
  | 'kb_generate'           // KB article generation
  | 'template_generation'   // Template AI generation
  | 'project_summary'       // Project dashboard summary
  | 'report_generation'     // Weekly/monthly report generation
  | 'task_similarity'       // Task duplicate detection
  | 'blueprint_export';     // Blueprint export AI sections

/**
 * Log AI usage to activity_logs table for tracking and analytics
 * @param supabase - Supabase client instance
 * @param userId - User ID who performed the AI action
 * @param featureType - Type of AI feature being used
 * @param metadata - AI response metadata (tokens, cost, timing, etc.)
 * @param resourceType - Optional resource type (e.g., 'project', 'article')
 * @param resourceId - Optional resource ID
 */
export async function logAIUsage(
  supabase: SupabaseClient,
  userId: string,
  featureType: AIFeatureType,
  metadata: AIResponseWithMetadata['metadata'],
  resourceType?: string | null,
  resourceId?: string | null
): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: 'ai_generate',
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      metadata: {
        ...metadata,
        feature_type: featureType,
      },
    });
  } catch (error) {
    logger.error(`[AI Usage] Failed to log ${featureType}:`, error);
  }
}

