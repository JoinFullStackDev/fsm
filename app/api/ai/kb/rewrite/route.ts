import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { generateStructuredAIResponse, AIResponseWithMetadata } from '@/lib/ai/geminiClient';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import logger from '@/lib/utils/logger';
import type { AIRewriteInput, AIRewriteOutput } from '@/types/kb';

// Type for structured AI response with metadata
interface StructuredAIResponseWithMetadata<T> {
  result: T;
  metadata?: AIResponseWithMetadata['metadata'];
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/kb/rewrite
 * Rewrite an article in a different style
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
        return forbidden('You do not have permission to rewrite articles');
      }
    }

    const body: AIRewriteInput = await request.json();
    const { article_id, style } = body;

    if (!article_id) {
      return badRequest('Article ID is required');
    }

    if (!style || !['clarity', 'step-by-step', 'developer-friendly'].includes(style)) {
      return badRequest('Style must be one of: clarity, step-by-step, developer-friendly');
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

    // Build style-specific instructions
    const styleInstructions: Record<string, string> = {
      clarity: 'Rewrite for maximum clarity and readability. Use simple language, short sentences, and clear explanations.',
      'step-by-step': 'Rewrite as a step-by-step guide. Break down complex processes into numbered steps with clear instructions.',
      'developer-friendly': 'Rewrite for developers. Include code examples, technical details, and implementation guidance.',
    };

    const prompt = `Rewrite the following knowledge base article in a ${style} style:

${styleInstructions[style]}

Original Article:
Title: ${article.title}
${article.summary ? `Summary: ${article.summary}` : ''}

Content:
${article.body}

Please rewrite the content maintaining all key information but adapting the style. Return as JSON:
{
  "body": "Rewritten content in markdown",
  "changes_summary": "Brief description of changes made"
}`;

    const response = await generateStructuredAIResponse<AIRewriteOutput>(
      prompt,
      {},
      apiKey,
      undefined,
      true, // returnMetadata
      'gemini-2.5-flash-lite' // Use Flash-Lite for style transformation
    );

    // Extract result and metadata
    let rewriteData: AIRewriteOutput;
    let metadata: AIResponseWithMetadata['metadata'] | null = null;

    if (typeof response === 'object' && response !== null && 'result' in response && 'metadata' in response) {
      const typedResponse = response as StructuredAIResponseWithMetadata<AIRewriteOutput>;
      rewriteData = typedResponse.result;
      metadata = typedResponse.metadata || null;
    } else if (typeof response === 'object' && response !== null && 'result' in response) {
      rewriteData = (response as { result: AIRewriteOutput }).result;
    } else {
      rewriteData = response as AIRewriteOutput;
    }

    // Log AI usage (non-blocking)
    if (metadata && userData?.id) {
      logAIUsage(
        supabase,
        userData.id,
        'kb_rewrite',
        metadata,
        'knowledge_base_article',
        article_id
      ).catch((err) => {
        logger.error('[KB AI Rewrite] Error logging AI usage:', err);
      });
    }

    return NextResponse.json(rewriteData);
  } catch (error) {
    logger.error('[KB AI Rewrite] Exception:', error);
    return internalError('Failed to rewrite article');
  }
}

