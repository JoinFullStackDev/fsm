import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateAIResponse, generateStructuredAIResponse } from '@/lib/ai/geminiClient';
import { getGeminiConfig } from '@/lib/utils/geminiConfig';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

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

    if (structured) {
      const result = await generateStructuredAIResponse(
        prompt,
        options,
        config.apiKey,
        config.projectName
      );
      return NextResponse.json({ result });
    } else {
      const result = await generateAIResponse(
        prompt,
        options,
        config.apiKey,
        config.projectName
      );
      return NextResponse.json({ result });
    }
  } catch (error) {
    logger.error('AI generation error:', error);
    return internalError('Failed to generate AI response', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
