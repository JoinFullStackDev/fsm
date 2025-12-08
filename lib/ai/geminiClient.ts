import { GoogleGenAI } from '@google/genai';
import logger from '@/lib/utils/logger';
import { estimateInputTokens, estimateOutputTokens } from './tokenEstimator';
import { calculateAICost } from './costCalculator';
import { requestDeduplicator } from '@/lib/utils/requestDeduplication';
import crypto from 'crypto';
import type { PhaseDataUnion } from '@/types/phases';
import type { Project } from '@/types/project';

// Fallback to environment variable for backwards compatibility
const defaultApiKey = process.env.GEMINI_API_KEY || '';

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite';

// Project data type that can be either the full Project type or a partial
type ProjectDataType = Project | Partial<Project> | Record<string, unknown>;

export interface AIPromptOptions {
  context?: string;
  phaseData?: PhaseDataUnion;
  projectData?: ProjectDataType;
  previousPhases?: PhaseDataUnion[];
}

export interface AIResponseWithMetadata {
  text: string;
  metadata: {
    prompt_length: number;
    full_prompt_length: number;
    response_length: number;
    model: string;
    response_time_ms: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    estimated_cost: number;
    error?: string;
  };
}

/**
 * Generate cache key for request deduplication
 */
function generateRequestKey(
  prompt: string,
  options: AIPromptOptions,
  projectName?: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(prompt);
  hash.update(JSON.stringify(options));
  if (projectName) {
    hash.update(projectName);
  }
  return `ai:${hash.digest('hex')}`;
}

/**
 * Create Gemini client instance with API key
 * Includes validation and better error handling
 */
function createGeminiClient(apiKey: string) {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }
  
  // Clean the API key (remove quotes if stored as JSON string)
  const cleanedKey = String(apiKey).trim().replace(/^["']|["']$/g, '');
  
  if (!cleanedKey || cleanedKey.length < 20) {
    throw new Error('Invalid API key format: Key is too short');
  }
  
  // Warn about non-standard key format (but don't fail - might be valid)
  const startsWithAIza = cleanedKey.startsWith('AIza');
  if (!startsWithAIza) {
    logger.warn('[Gemini Client] API key does not start with "AIza" - this is unusual for Gemini API keys');
    logger.warn('[Gemini Client] This might be a Vertex AI key or a different type of key');
  }
  
  try {
    const client = new GoogleGenAI({ apiKey: cleanedKey });
    return client;
  } catch (error) {
    logger.error('[Gemini Client] Failed to initialize client:', error);
    throw new Error(
      `Failed to initialize Gemini client: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate AI response using Gemini with enhanced metadata tracking
 * @param prompt - The prompt to send to Gemini
 * @param options - Additional options for the prompt
 * @param apiKey - Optional API key (if not provided, uses default from env)
 * @param projectName - Optional project name for context
 * @param returnMetadata - If true, returns enhanced response with metadata
 * @param model - The Gemini model to use (default: gemini-2.5-flash)
 */
export async function generateAIResponse(
  prompt: string,
  options: AIPromptOptions = {},
  apiKey?: string,
  projectName?: string,
  returnMetadata: boolean = false,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string | AIResponseWithMetadata> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini API key not configured');
  }
  const startTime = Date.now();

  // Generate request key for deduplication
  const requestKey = generateRequestKey(prompt, options, projectName);

  // Use request deduplication to prevent duplicate concurrent requests
  return requestDeduplicator.execute(requestKey, async () => {
    try {
      // Step 1: Initialize client with better error handling
      let client;
      try {
        client = createGeminiClient(key);
      } catch (initError) {
        logger.error('[AI Generation] Client initialization failed:', initError);
        throw new Error(
          `Failed to initialize Gemini client: ${initError instanceof Error ? initError.message : 'Unknown error'}`
        );
      }

    // Step 2: Build context-aware prompt
    let fullPrompt = prompt;
    const originalPromptLength = prompt.length;

    // Add project name to context if provided
    if (projectName) {
      fullPrompt = `Project: ${projectName}\n\n${fullPrompt}`;
    }

    if (options.context) {
      fullPrompt = `Context: ${options.context}\n\n${fullPrompt}`;
    }

    if (options.phaseData) {
      // Optimized: Use compact JSON (no pretty printing) to reduce token count
      fullPrompt += `\n\nCurrent phase data: ${JSON.stringify(options.phaseData)}`;
    }

    if (options.projectData) {
      // Optimized: Use compact JSON (no pretty printing) to reduce token count
      fullPrompt += `\n\nProject information: ${JSON.stringify(options.projectData)}`;
    }

    if (options.previousPhases && options.previousPhases.length > 0) {
      // Optimized: Use compact JSON (no pretty printing) to reduce token count
      fullPrompt += `\n\nPrevious phases data: ${JSON.stringify(options.previousPhases)}`;
    }

    const fullPromptLength = fullPrompt.length;

    // Step 3: Make API call with better error handling
    let response;
    try {
      logger.debug('[AI Generation] Making API call...');
      logger.debug('[AI Generation] Model:', model);
      logger.debug('[AI Generation] Prompt length:', fullPromptLength);
      logger.debug('[AI Generation] Prompt preview:', fullPrompt.substring(0, 200));
      
      response = await client.models.generateContent({
        model,
        contents: fullPrompt,
      });
      
      logger.debug('[AI Generation] API call successful');
    } catch (apiError) {
      const responseTime = Date.now() - startTime;
      logger.error('[AI Generation] API call failed:', apiError);
      
      // If metadata requested, return error metadata
      if (returnMetadata) {
        const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
        const estimatedInputTokens = estimateInputTokens(
          prompt,
          options.context,
          options.phaseData,
          options.projectData,
          options.previousPhases
        );
        
        return {
          text: '',
          metadata: {
            prompt_length: originalPromptLength,
            full_prompt_length: fullPromptLength,
            response_length: 0,
            model,
            response_time_ms: responseTime,
            input_tokens: estimatedInputTokens,
            output_tokens: 0,
            total_tokens: estimatedInputTokens,
            estimated_cost: calculateAICost(model, estimatedInputTokens, 0, fullPromptLength, 0),
            error: errorMessage,
          },
        };
      }
      
      // Provide more specific error messages
      if (apiError instanceof Error) {
        if (apiError.message.includes('401') || apiError.message.includes('Unauthorized')) {
          throw new Error('Invalid API key. Please check your Gemini API key configuration.');
        } else if (apiError.message.includes('403') || apiError.message.includes('Forbidden')) {
          throw new Error('API key does not have permission to access Gemini API.');
        } else if (apiError.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }
      
      throw new Error(
        `Gemini API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`
      );
    }

    const responseTime = Date.now() - startTime;

    // Step 4: Extract text and usage data from response
    const responseText = response.text || '';
    if (!responseText && !returnMetadata) {
      logger.error('[AI Generation] No text in response:', response);
      throw new Error('No text response from Gemini API');
    }

    // Try to extract token usage from response
    // The @google/genai SDK may expose usage in different ways
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let totalTokens: number | undefined;

    try {
      // Check various possible locations for usage data
      const responseAny = response as any;
      if (responseAny.usage) {
        inputTokens = responseAny.usage.promptTokenCount || responseAny.usage.inputTokens;
        outputTokens = responseAny.usage.candidatesTokenCount || responseAny.usage.outputTokens;
        totalTokens = responseAny.usage.totalTokenCount || responseAny.usage.totalTokens;
      } else if (responseAny.response?.usage) {
        inputTokens = responseAny.response.usage.promptTokenCount || responseAny.response.usage.inputTokens;
        outputTokens = responseAny.response.usage.candidatesTokenCount || responseAny.response.usage.outputTokens;
        totalTokens = responseAny.response.usage.totalTokenCount || responseAny.response.usage.totalTokens;
      }
    } catch (usageError) {
      logger.debug('[AI Generation] Could not extract usage data from response:', usageError);
    }

    // Fallback to estimation if tokens not available
    if (inputTokens === undefined || outputTokens === undefined) {
      inputTokens = estimateInputTokens(
        prompt,
        options.context,
        options.phaseData,
        options.projectData,
        options.previousPhases
      );
      outputTokens = estimateOutputTokens(responseText, model);
      totalTokens = inputTokens + outputTokens;
    } else {
      totalTokens = totalTokens || (inputTokens + outputTokens);
    }

    const estimatedCost = calculateAICost(
      model,
      inputTokens,
      outputTokens,
      fullPromptLength,
      responseText.length
    );

    // Return enhanced response if metadata requested
    if (returnMetadata) {
      return {
        text: responseText,
        metadata: {
          prompt_length: originalPromptLength,
          full_prompt_length: fullPromptLength,
          response_length: responseText.length,
          model,
          response_time_ms: responseTime,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost,
        },
      };
    }
    
      return responseText;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('[AI Generation] Error:', error);
      
      // If metadata requested, return error metadata
      if (returnMetadata) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const estimatedInputTokens = estimateInputTokens(
          prompt,
          options.context,
          options.phaseData,
          options.projectData,
          options.previousPhases
        );
        
        return {
          text: '',
          metadata: {
            prompt_length: prompt.length,
            full_prompt_length: prompt.length,
            response_length: 0,
            model,
            response_time_ms: responseTime,
            input_tokens: estimatedInputTokens,
            output_tokens: 0,
            total_tokens: estimatedInputTokens,
            estimated_cost: calculateAICost(model, estimatedInputTokens, 0, prompt.length, 0),
            error: errorMessage,
          },
        };
      }
      
      // Re-throw if it's already a well-formed error
      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('Unauthorized'))) {
        throw error;
      }
      
      throw new Error(
        error instanceof Error ? error.message : 'Failed to generate AI response'
      );
    }
  });
}

/**
 * Generate structured JSON response with enhanced metadata tracking
 * @param prompt - The prompt to send to Gemini
 * @param options - Additional options for the prompt
 * @param apiKey - Optional API key (if not provided, uses default from env)
 * @param projectName - Optional project name for context
 * @param returnMetadata - If true, returns enhanced response with metadata
 * @param model - The Gemini model to use (default: gemini-2.5-flash)
 */
export async function generateStructuredAIResponse<T>(
  prompt: string,
  options: AIPromptOptions = {},
  apiKey?: string,
  projectName?: string,
  returnMetadata: boolean = false,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<T | { result: T; metadata: AIResponseWithMetadata['metadata'] }> {
  const enhancedPrompt = `${prompt}\n\nPlease respond with valid JSON only, no additional text.`;
  const response = await generateAIResponse(
    enhancedPrompt,
    options,
    apiKey,
    projectName,
    returnMetadata,
    model
  );

  // Handle metadata response
  if (returnMetadata && typeof response === 'object' && 'metadata' in response) {
    const metadataResponse = response as AIResponseWithMetadata;
    const jsonString = metadataResponse.text.trim();
    
    try {
      const parsed = parseJSONResponse<T>(jsonString);
      return {
        result: parsed,
        metadata: metadataResponse.metadata,
      };
    } catch (error) {
      // Return error in metadata
      return {
        result: {} as T,
        metadata: {
          ...metadataResponse.metadata,
          error: `JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      };
    }
  }

  // Handle string response (backward compatibility)
  const responseText = typeof response === 'string' ? response : '';
  try {
    const jsonString = responseText.trim();
    return parseJSONResponse<T>(jsonString);
  } catch (error) {
    logger.error('[AI] Failed to parse JSON response');
    logger.error('[AI] Response length:', responseText.length);
    logger.error('[AI] Response preview (first 500 chars):', responseText.substring(0, 500));
    logger.error('[AI] Parse error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    throw new Error(
      `Failed to parse AI response as JSON: ${errorMessage}. ` +
      `Response preview: ${responseText.substring(0, 200)}...`
    );
  }
}

/**
 * Parse JSON response with markdown code block handling
 */
function parseJSONResponse<T>(jsonString: string): T {
  try {
    let cleanedJson = jsonString.trim();

    // Step 1: Remove markdown code blocks if present
    // Handle ```json ... ``` or ``` ... ```
    const codeBlockMatch = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleanedJson = codeBlockMatch[1].trim();
    }

    // Step 2: Try to extract JSON object/array from the string
    // First, try to find the outermost JSON object/array
    let jsonMatch: RegExpMatchArray | null = null;
    
    // Try to match JSON object
    const objectMatch = cleanedJson.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonMatch = objectMatch;
    } else {
      // Try to match JSON array
      const arrayMatch = cleanedJson.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonMatch = arrayMatch;
      }
    }

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch (parseError) {
        // If parsing the matched JSON fails, try the whole string
        logger.warn('[AI] Failed to parse extracted JSON, trying full string:', parseError);
      }
    }

    // Step 3: Try parsing the entire cleaned string
    return JSON.parse(cleanedJson) as T;
  } catch (error) {
    // Log the actual response for debugging
    logger.error('[AI] Failed to parse JSON response');
    logger.error('[AI] Response length:', jsonString.length);
    logger.error('[AI] Response preview (first 500 chars):', jsonString.substring(0, 500));
    logger.error('[AI] Parse error:', error);
    
    // Provide more helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    throw new Error(
      `Failed to parse AI response as JSON: ${errorMessage}. ` +
      `Response preview: ${jsonString.substring(0, 200)}...`
    );
  }
}
