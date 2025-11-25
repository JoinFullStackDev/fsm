import { GoogleGenAI } from '@google/genai';
import logger from '@/lib/utils/logger';

// Fallback to environment variable for backwards compatibility
const defaultApiKey = process.env.GEMINI_API_KEY || '';

export interface AIPromptOptions {
  context?: string;
  phaseData?: any;
  projectData?: any;
  previousPhases?: any[];
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
 * Generate AI response using Gemini
 * @param prompt - The prompt to send to Gemini
 * @param options - Additional options for the prompt
 * @param apiKey - Optional API key (if not provided, uses default from env)
 * @param projectName - Optional project name for context
 */
export async function generateAIResponse(
  prompt: string,
  options: AIPromptOptions = {},
  apiKey?: string,
  projectName?: string
): Promise<string> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini API key not configured');
  }

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

    // Add project name to context if provided
    if (projectName) {
      fullPrompt = `Project: ${projectName}\n\n${fullPrompt}`;
    }

    if (options.context) {
      fullPrompt = `Context: ${options.context}\n\n${fullPrompt}`;
    }

    if (options.phaseData) {
      fullPrompt += `\n\nCurrent phase data: ${JSON.stringify(options.phaseData, null, 2)}`;
    }

    if (options.projectData) {
      fullPrompt += `\n\nProject information: ${JSON.stringify(options.projectData, null, 2)}`;
    }

    if (options.previousPhases && options.previousPhases.length > 0) {
      fullPrompt += `\n\nPrevious phases data: ${JSON.stringify(options.previousPhases, null, 2)}`;
    }

    // Step 3: Make API call with better error handling
    // Note: TypeScript SDK uses object format: { model, contents }
    // Python SDK uses separate parameters: generate_content(model=..., contents=...)
    // Both should work, but TypeScript requires object format
    let response;
    try {
      logger.debug('[AI Generation] Making API call...');
      logger.debug('[AI Generation] Model: gemini-2.5-flash');
      logger.debug('[AI Generation] Prompt length:', fullPrompt.length);
      logger.debug('[AI Generation] Prompt preview:', fullPrompt.substring(0, 200));
      
      response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,  // String format (matches Python guide)
      });
      
      logger.debug('[AI Generation] API call successful');
    } catch (apiError) {
      logger.error('[AI Generation] API call failed:', apiError);
      
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

    // Step 4: Extract text from response
    // The response.text getter returns string | undefined
    const responseText = response.text;
    if (!responseText) {
      logger.error('[AI Generation] No text in response:', response);
      throw new Error('No text response from Gemini API');
    }
    
    return responseText;
  } catch (error) {
    logger.error('[AI Generation] Error:', error);
    
    // Re-throw if it's already a well-formed error
    if (error instanceof Error && (error.message.includes('API key') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    
    throw new Error(
      error instanceof Error ? error.message : 'Failed to generate AI response'
    );
  }
}

/**
 * Generate structured JSON response
 */
export async function generateStructuredAIResponse<T>(
  prompt: string,
  options: AIPromptOptions = {},
  apiKey?: string,
  projectName?: string
): Promise<T> {
  const response = await generateAIResponse(
    `${prompt}\n\nPlease respond with valid JSON only, no additional text.`,
    options,
    apiKey,
    projectName
  );

  try {
    let jsonString = response.trim();

    // Step 1: Remove markdown code blocks if present
    // Handle ```json ... ``` or ``` ... ```
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    // Step 2: Try to extract JSON object/array from the string
    // First, try to find the outermost JSON object/array
    let jsonMatch: RegExpMatchArray | null = null;
    
    // Try to match JSON object
    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonMatch = objectMatch;
    } else {
      // Try to match JSON array
      const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
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
    return JSON.parse(jsonString) as T;
  } catch (error) {
    // Log the actual response for debugging
    logger.error('[AI] Failed to parse JSON response');
    logger.error('[AI] Response length:', response.length);
    logger.error('[AI] Response preview (first 500 chars):', response.substring(0, 500));
    logger.error('[AI] Parse error:', error);
    
    // Provide more helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    throw new Error(
      `Failed to parse AI response as JSON: ${errorMessage}. ` +
      `Response preview: ${response.substring(0, 200)}...`
    );
  }
}
