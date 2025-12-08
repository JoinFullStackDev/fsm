import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures, getKnowledgeBaseAccessLevel } from '@/lib/packageLimits';
import { generateAIResponse, AIResponseWithMetadata } from '@/lib/ai/geminiClient';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import { retrieveRelevantArticles, buildRAGContext, buildRAGPrompt, extractSources } from '@/lib/kb/rag';
import logger from '@/lib/utils/logger';
import type { AIChatInput, AIChatOutput } from '@/types/kb';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/kb/chat
 * RAG Q&A chatbot
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to use AI chat');
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

      // Check KB access level (need read_ai or higher)
      const accessLevel = await getKnowledgeBaseAccessLevel(supabase, organizationId);
      if (accessLevel === 'none' || accessLevel === 'read_global' || accessLevel === 'read_all') {
        return forbidden('You do not have permission to use AI Q&A');
      }
    }

    const body: AIChatInput = await request.json();
    const { query, conversation_history } = body;

    if (!query || query.trim().length === 0) {
      return badRequest('Query is required');
    }

    // Get Gemini API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return badRequest('Gemini API key not configured');
    }

    const startTime = Date.now();

    // Retrieve relevant articles using semantic search
    logger.debug('[KB AI Chat] Retrieving articles', { query, organizationId });
    const retrievedArticles = await retrieveRelevantArticles(
      supabase,
      query,
      organizationId,
      5 // top-k articles
    );

    logger.debug('[KB AI Chat] Retrieved articles', { 
      count: retrievedArticles.length,
      articles: retrievedArticles.map(a => ({ title: a.article.title, score: a.relevance_score }))
    });

    if (retrievedArticles.length === 0) {
      logger.warn('[KB AI Chat] No articles found', { query, organizationId });
      const noResultsResponse: AIChatOutput = {
        answer: "I couldn't find any relevant articles in the knowledge base to answer your question. Please try rephrasing your query or check if the information exists in the knowledge base.",
        sources: [],
        metadata: {
          model: 'gemini-2.5-flash-lite',
          tokens_used: 0,
          response_time_ms: Date.now() - startTime,
        },
      };
      return NextResponse.json(noResultsResponse);
    }

    // Build RAG context
    const context = buildRAGContext(retrievedArticles);

    // Build prompt with conversation history
    let systemInstructions = `You are a helpful assistant that answers questions based solely on the provided knowledge base articles.
- Only use information from the provided context
- If the context doesn't contain enough information to answer the question, say so
- Cite specific articles when referencing information
- Be concise but thorough
- Format your response in clear, readable markdown`;

    if (conversation_history && conversation_history.length > 0) {
      const historyText = conversation_history
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      systemInstructions += `\n\nPrevious conversation:\n${historyText}`;
    }

    const prompt = buildRAGPrompt(query, context, systemInstructions);

    // Generate answer using Gemini with Flash-Lite for conversational tasks
    const aiResponse = await generateAIResponse(
      prompt,
      {},
      apiKey,
      undefined,
      true, // returnMetadata
      'gemini-2.5-flash-lite' // Use Flash-Lite for conversational Q&A
    );

    const answer = typeof aiResponse === 'string' ? aiResponse : (aiResponse as AIResponseWithMetadata).text;
    let metadata: AIResponseWithMetadata['metadata'] | null = null;
    if (typeof aiResponse === 'object' && 'metadata' in aiResponse) {
      metadata = (aiResponse as AIResponseWithMetadata).metadata || null;
    }

    // Extract sources
    const sources = extractSources(context);

    // Track AI usage in both knowledge_base_analytics (existing) and activity_logs (new)
    trackAIChatUsage(supabase, authUser.id, query, organizationId).catch((err) => {
      logger.error('[KB AI Chat] Error tracking usage:', err);
    });

    // Also log to activity_logs for super admin tracking
    if (metadata && userData?.id) {
      logAIUsage(
        supabase,
        userData.id,
        'kb_chat',
        metadata,
        null,
        null
      ).catch((err) => {
        logger.error('[KB AI Chat] Error logging AI usage:', err);
      });
    }

    const response: AIChatOutput = {
      answer,
      sources,
      metadata: {
        model: metadata?.model || 'gemini-2.5-flash-lite',
        tokens_used: metadata?.total_tokens || 0,
        response_time_ms: Date.now() - startTime,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[KB AI Chat] Exception:', error);
    return internalError('Failed to process chat query');
  }
}

/**
 * Track AI chat usage
 */
async function trackAIChatUsage(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  organizationId: string | null
): Promise<void> {
  try {
    await supabase.from('knowledge_base_analytics').insert({
      article_id: null,
      user_id: userId,
      action_type: 'ai_query',
      metadata: {
        ai_action: 'chat',
        query,
      },
    });
  } catch (error) {
    logger.debug('[KB AI Chat] Analytics tracking failed:', error);
  }
}

