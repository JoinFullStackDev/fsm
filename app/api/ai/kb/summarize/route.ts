import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { generateStructuredAIResponse } from '@/lib/ai/geminiClient';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import logger from '@/lib/utils/logger';
import type { AISummarizeInput, AISummarizeOutput } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/kb/summarize
 * Summarize an article
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
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);

    // Check AI features access
    if (organizationId) {
      const hasAI = await hasAIFeatures(supabase, organizationId);
      if (!hasAI) {
        return forbidden('AI features are not enabled for your organization');
      }

      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel !== 'full' && accessLevel !== 'full_plus') {
        return forbidden('You do not have permission to use AI summarization');
      }
    }

    const body: AISummarizeInput = await request.json();
    const { article_id } = body;

    if (!article_id) {
      return badRequest('Article ID is required');
    }

    // Get article
    const { data: article, error: articleError } = await supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('id', article_id)
      .single();

    if (articleError || !article) {
      return notFound('Article not found');
    }

    // Get Gemini API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return badRequest('Gemini API key not configured');
    }

    // Build summarization prompt
    const prompt = `Summarize the following knowledge base article and extract key information:

Title: ${article.title}
${article.summary ? `Existing Summary: ${article.summary}` : ''}

Content:
${article.body}

Please provide:
1. A concise summary (2-3 sentences)
2. A TL;DR (one sentence)
3. Estimated reading time in minutes
4. Difficulty level: beginner, intermediate, or advanced
5. Key points (3-5 bullet points)

Return as JSON:
{
  "summary": "Full summary",
  "tldr": "One sentence TL;DR",
  "reading_time": 5,
  "difficulty": "beginner|intermediate|advanced",
  "key_points": ["point 1", "point 2", ...]
}`;

    const response = await generateStructuredAIResponse<AISummarizeOutput>(
      prompt,
      {},
      apiKey,
      undefined,
      true, // returnMetadata
      'gemini-2.5-flash-lite' // Use Flash-Lite for simpler summarization task
    );

    // Extract result and metadata
    let summaryData: AISummarizeOutput;
    let metadata: any = null;

    if (typeof response === 'object' && response !== null && 'result' in response && 'metadata' in response) {
      summaryData = (response as { result: AISummarizeOutput; metadata: any }).result;
      metadata = (response as { result: AISummarizeOutput; metadata: any }).metadata;
    } else if (typeof response === 'object' && response !== null && 'result' in response) {
      summaryData = (response as { result: AISummarizeOutput }).result;
    } else {
      summaryData = response as AISummarizeOutput;
    }

    // Log AI usage (non-blocking)
    if (metadata && userData?.id) {
      logAIUsage(
        supabase,
        userData.id,
        'kb_summarize',
        metadata,
        'knowledge_base_article',
        article_id
      ).catch((err) => {
        logger.error('[KB AI Summarize] Error logging AI usage:', err);
      });
    }

    return NextResponse.json(summaryData);
  } catch (error) {
    logger.error('[KB AI Summarize] Exception:', error);
    return internalError('Failed to summarize article');
  }
}

