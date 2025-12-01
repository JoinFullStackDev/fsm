import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { generateStructuredAIResponse } from '@/lib/ai/geminiClient';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import logger from '@/lib/utils/logger';
import type { AIGenerateFAQInput, AIGenerateFAQOutput } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/kb/faq
 * Generate FAQs from an article
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to use AI features');
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
        return forbidden('You do not have permission to generate FAQs');
      }
    }

    const body: AIGenerateFAQInput = await request.json();
    const { article_id, num_questions = 5 } = body;

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

    const prompt = `Generate ${num_questions} frequently asked questions (FAQs) based on the following knowledge base article:

Title: ${article.title}
${article.summary ? `Summary: ${article.summary}` : ''}

Content:
${article.body}

Generate questions that users might have about this topic. Return as JSON:
{
  "faqs": [
    {
      "question": "Question text",
      "answer": "Answer text"
    },
    ...
  ]
}`;

    const response = await generateStructuredAIResponse<AIGenerateFAQOutput>(
      prompt,
      {},
      apiKey,
      undefined,
      false
    );

    const faqData = 'result' in response ? response.result : response;

    return NextResponse.json(faqData);
  } catch (error) {
    logger.error('[KB AI FAQ] Exception:', error);
    return internalError('Failed to generate FAQs');
  }
}

