import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateAIResponse, generateStructuredAIResponse, AIResponseWithMetadata } from '@/lib/ai/geminiClient';
import { getGeminiConfig } from '@/lib/utils/geminiConfig';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Type for structured AI responses with metadata
interface StructuredAIResponseWithMetadata {
  result?: unknown;
  text?: string;
  metadata?: AIResponseWithMetadata['metadata'];
}

/**
 * POST /api/ai/generate
 * 
 * Generates AI responses using the Gemini API.
 * Supports both structured (JSON) and unstructured responses.
 * Requires authentication and valid Gemini API configuration.
 * 
 * @param request - Next.js request object containing:
 *   - prompt: The text prompt for the AI
 *   - options: Optional configuration (context, phaseData, etc.)
 *   - structured: Boolean to request structured JSON response
 * 
 * @returns AI-generated response or error
 * 
 * @example
 * POST /api/ai/generate
 * Body: { prompt: "Generate a problem statement", structured: false }
 * Response: { result: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to use AI features');
    }

    // Get Gemini configuration from database
    const config = await getGeminiConfig(supabase);
    
    if (!config || !config.enabled) {
      return forbidden('Gemini AI features are disabled or not configured');
    }

    if (!config.apiKey) {
      return badRequest('Gemini API key not configured. Please configure it in Admin > API Config');
    }

    const body = await request.json();
    const { prompt, options, structured } = body;

    if (!prompt) {
      return badRequest('Prompt is required');
    }

    // Get user record for logging
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    const startTime = Date.now();
    let result: unknown;
    let metadata: AIResponseWithMetadata['metadata'] | null = null;
    let error: string | undefined = undefined;

    try {
      if (structured) {
        const response = await generateStructuredAIResponse(
          prompt,
          options,
          config.apiKey,
          config.projectName,
          true // Request metadata
        );
        
        // Handle metadata response
        if (response && typeof response === 'object' && 'metadata' in response) {
          const typedResponse = response as StructuredAIResponseWithMetadata;
          result = typedResponse.result;
          metadata = typedResponse.metadata || null;
        } else {
          result = response;
        }
      } else {
        const response = await generateAIResponse(
          prompt,
          options,
          config.apiKey,
          config.projectName,
          true // Request metadata
        );
        
        // Handle metadata response
        if (response && typeof response === 'object' && 'metadata' in response) {
          const typedResponse = response as AIResponseWithMetadata;
          result = typedResponse.text;
          metadata = typedResponse.metadata || null;
        } else {
          result = response;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[AI Generate] Error:', err);
      
      // Still try to log the error
      if (userData?.id) {
        const errorMetadata = {
          feature_type: 'ai_generate',
          structured,
          prompt_length: prompt.length,
          full_prompt_length: prompt.length,
          response_length: 0,
          model: 'gemini-2.5-flash',
          response_time_ms: Date.now() - startTime,
          estimated_cost: 0,
          error,
          error_type: err instanceof Error && err.message.includes('401') ? 'authentication' :
                      err instanceof Error && err.message.includes('429') ? 'rate_limit' : 'api_error',
          has_context: !!options?.context,
          has_phase_data: !!options?.phaseData,
        };
        
        // Fire and forget - log error asynchronously
        (async () => {
          try {
            await supabase
              .from('activity_logs')
              .insert({
                user_id: userData.id,
                action_type: 'ai_generate',
                resource_type: options?.projectId ? 'project' : null,
                resource_id: options?.projectId || null,
                metadata: errorMetadata,
              });
          } catch (logError) {
            logger.error('[AI Generate] Error logging AI usage:', logError);
          }
        })();
      }
      
      throw err; // Re-throw to be handled by outer catch
    }

    // Log AI usage with enhanced metadata (non-blocking)
    if (userData?.id && metadata) {
      // Fire and forget - log usage asynchronously
      (async () => {
        try {
          await supabase
            .from('activity_logs')
            .insert({
              user_id: userData.id,
              action_type: 'ai_generate',
              resource_type: options?.projectId ? 'project' : null,
              resource_id: options?.projectId || null,
              metadata: {
                ...metadata,
                feature_type: 'ai_generate',
                structured,
                has_context: !!options?.context,
                has_phase_data: !!options?.phaseData,
              },
            });
        } catch (logError) {
          logger.error('[AI Generate] Error logging AI usage:', logError);
          // Don't fail the request if logging fails
        }
      })();
    }

    return NextResponse.json({ result });
  } catch (error) {
    logger.error('AI generation error:', error);
    return internalError('Failed to generate AI response', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
