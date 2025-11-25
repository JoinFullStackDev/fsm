import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateAIResponse, generateStructuredAIResponse } from '@/lib/ai/geminiClient';
import type { AdminSetting } from '@/types/project';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

/**
 * Retrieves Gemini API configuration from the admin_settings table
 * 
 * Fetches API key, enabled status, and project name settings.
 * Handles API key cleaning (removes quotes if stored as JSON string).
 * 
 * @param supabase - Supabase client instance
 * @returns Configuration object with enabled, apiKey, and projectName, or null on error
 */
async function getGeminiConfig(supabase: any) {
  const { API_CONFIG_KEYS } = await import('@/lib/constants');
  
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .in('key', [API_CONFIG_KEYS.GEMINI_KEY, API_CONFIG_KEYS.GEMINI_KEY_ALT, API_CONFIG_KEYS.GEMINI_ENABLED, API_CONFIG_KEYS.GEMINI_PROJECT_NAME]);

  if (error) {
    logger.error('Error fetching Gemini config:', error);
    return null;
  }

  const settings = data as AdminSetting[];
  const keySetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_KEY || s.key === API_CONFIG_KEYS.GEMINI_KEY_ALT);
  const enabledSetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_ENABLED);
  const projectNameSetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_PROJECT_NAME);

  const enabled = enabledSetting?.value !== undefined ? Boolean(enabledSetting.value) : true;
  // Clean API key - remove quotes if stored as JSON string
  let apiKey = keySetting?.value ? String(keySetting.value) : null;
  if (apiKey) {
    const originalLength = apiKey.length;
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    
    // Log API key retrieval for debugging (masked)
    logger.debug('[Gemini Config] API key retrieved from database');
    logger.debug('[Gemini Config] Original length:', originalLength);
    logger.debug('[Gemini Config] Cleaned length:', apiKey.length);
    logger.debug('[Gemini Config] Starts with AIza:', apiKey.startsWith('AIza'));
    logger.debug('[Gemini Config] First 4 chars:', apiKey.substring(0, 4));
    logger.debug('[Gemini Config] Last 4 chars:', apiKey.substring(apiKey.length - 4));
    
    // Warn if key format looks wrong
    if (!apiKey.startsWith('AIza')) {
      logger.warn('[Gemini Config] ⚠️  API key does not start with "AIza" - unusual format');
    }
  }
  const projectName = projectNameSetting?.value ? String(projectNameSetting.value) : undefined;

  return { enabled, apiKey, projectName };
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
