import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { generateStructuredAIResponse } from '@/lib/ai/geminiClient';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import logger from '@/lib/utils/logger';
import type { AIGenerateArticleInput, AIGenerateArticleOutput } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/kb/generate
 * Generate article content using AI
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to use AI features');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const organizationId = userData.organization_id;

    // Check AI features access
    if (organizationId) {
      const hasAI = await hasAIFeatures(supabase, organizationId);
      if (!hasAI) {
        return forbidden('AI features are not enabled for your organization');
      }

      // Check KB access level (need full or full_plus for authoring)
      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel !== 'full' && accessLevel !== 'full_plus') {
        return forbidden('You do not have permission to generate articles');
      }
    }

    // Check if user is admin or PM
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!isAdminOrPM && organizationId) {
      return forbidden('Only admins and PMs can generate articles');
    }

    const body: AIGenerateArticleInput = await request.json();
    const { prompt, context, category_id, tags } = body;

    if (!prompt || prompt.trim().length === 0) {
      return badRequest('Prompt is required');
    }

    // Get Gemini API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return badRequest('Gemini API key not configured');
    }

    // Build generation prompt
    const generationPrompt = `Generate a comprehensive knowledge base article based on the following prompt:

${prompt}

${context ? `\nAdditional context:\n${context}` : ''}

Please generate a complete article with the following structure:
1. Title: A clear, descriptive title
2. Summary: A brief 2-3 sentence summary
3. Body: Well-structured markdown content with:
   - Introduction
   - Main sections with headers
   - Examples where appropriate
   - Conclusion
4. Tags: Relevant tags (5-10 tags)
5. Category suggestions: Suggest 3-5 relevant categories with confidence scores
6. Metadata:
   - Difficulty level: beginner, intermediate, or advanced
   - Estimated reading time in minutes

Return the response as a JSON object with this exact structure:
{
  "title": "Article Title",
  "summary": "Brief summary",
  "body": "Full markdown content...",
  "tags": ["tag1", "tag2", ...],
  "category_suggestions": [
    {"id": "category-id", "name": "Category Name", "confidence": 0.9}
  ],
  "metadata": {
    "difficulty": "beginner|intermediate|advanced",
    "estimated_reading_time": 5
  }
}`;

    // Generate article using Gemini with Flash for quality content generation
    const response = await generateStructuredAIResponse<AIGenerateArticleOutput>(
      generationPrompt,
      {},
      apiKey,
      undefined,
      true, // returnMetadata
      'gemini-2.5-flash' // Use Flash for quality content creation
    );

    // Extract result and metadata
    let articleData: AIGenerateArticleOutput;
    let metadata: any = null;

    if (typeof response === 'object' && response !== null && 'result' in response && 'metadata' in response) {
      articleData = (response as { result: AIGenerateArticleOutput; metadata: any }).result;
      metadata = (response as { result: AIGenerateArticleOutput; metadata: any }).metadata;
    } else if (typeof response === 'object' && response !== null && 'result' in response) {
      articleData = (response as { result: AIGenerateArticleOutput }).result;
    } else {
      articleData = response as AIGenerateArticleOutput;
    }

    // Track AI usage in both knowledge_base_analytics (existing) and activity_logs (new)
    trackAIUsage(supabase, userData.id, 'generate', organizationId).catch((err) => {
      logger.error('[KB AI Generate] Error tracking usage:', err);
    });

    // Also log to activity_logs for super admin tracking
    if (metadata && userData?.id) {
      logAIUsage(
        supabase,
        userData.id,
        'kb_generate',
        metadata,
        null,
        null
      ).catch((err) => {
        logger.error('[KB AI Generate] Error logging AI usage:', err);
      });
    }

    return NextResponse.json(articleData);
  } catch (error) {
    logger.error('[KB AI Generate] Exception:', error);
    return internalError('Failed to generate article');
  }
}

/**
 * Track AI usage in analytics
 */
async function trackAIUsage(
  supabase: any,
  userId: string,
  action: string,
  organizationId: string | null
): Promise<void> {
  try {
    // Find an article from the organization to associate with (or use null for global)
    let articleId = null;
    if (organizationId) {
      const { data: article } = await supabase
        .from('knowledge_base_articles')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(1)
        .single();

      if (article) {
        articleId = article.id;
      }
    }

    await supabase.from('knowledge_base_analytics').insert({
      article_id: articleId,
      user_id: userId,
      action_type: 'ai_query',
      metadata: {
        ai_action: action,
      },
    });
  } catch (error) {
    logger.debug('[KB AI Generate] Analytics tracking failed:', error);
  }
}

