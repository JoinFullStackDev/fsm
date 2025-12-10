/**
 * AI Actions
 * Generate content, categorize, and summarize using Gemini AI
 */

import { generateAIResponse, generateStructuredAIResponse } from '@/lib/ai/geminiClient';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { interpolateTemplate, getNestedValue } from '../templating';
import type { 
  AIGenerateConfig, 
  AICategorizeConfig, 
  AISummarizeConfig, 
  WorkflowContext 
} from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute AI generate action
 * 
 * @param config - AI generation configuration
 * @param context - Workflow context
 * @returns Action result with generated content
 */
export async function executeAIGenerate(
  config: AIGenerateConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const aiConfig = config as AIGenerateConfig;
  
  // Interpolate the prompt template
  const prompt = interpolateTemplate(aiConfig.prompt_template, context);
  
  logger.info('[AIGenerate] Generating content:', {
    outputField: aiConfig.output_field,
    promptLength: prompt.length,
    structured: aiConfig.structured,
  });
  
  try {
    // Get API key
    const supabase = await createServerSupabaseClient();
    const apiKey = await getGeminiApiKey(supabase);
    
    if (!apiKey) {
      logger.error('[AIGenerate] Gemini API key not configured');
      throw new Error('Gemini API key not configured');
    }
    
    let result: string;
    
    if (aiConfig.structured) {
      const response = await generateStructuredAIResponse(prompt, {}, apiKey) as { result: unknown };
      result = JSON.stringify(response.result);
    } else {
      result = await generateAIResponse(prompt, {}, apiKey) as string;
    }
    
    logger.info('[AIGenerate] Content generated:', {
      outputField: aiConfig.output_field,
      resultLength: result.length,
    });
    
    return {
      output: {
        success: true,
        [aiConfig.output_field]: result,
        prompt_used: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
        generated_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[AIGenerate] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute AI categorize action
 * 
 * @param config - AI categorization configuration
 * @param context - Workflow context
 * @returns Action result with category
 */
export async function executeAICategorize(
  config: AICategorizeConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const aiConfig = config as AICategorizeConfig;
  
  // Get the text to analyze from context
  const textToAnalyze = getNestedValue(context, aiConfig.field_to_analyze);
  
  if (!textToAnalyze) {
    logger.warn('[AICategorize] No text found to analyze:', {
      field: aiConfig.field_to_analyze,
    });
    return {
      output: {
        success: false,
        skipped: true,
        reason: `No text found at ${aiConfig.field_to_analyze}`,
        [aiConfig.output_field]: null,
      },
    };
  }
  
  const textStr = typeof textToAnalyze === 'string' 
    ? textToAnalyze 
    : JSON.stringify(textToAnalyze);
  
  // Build categorization prompt
  const prompt = `Analyze the following text and categorize it into one of these categories: ${aiConfig.categories.join(', ')}.

Text: "${textStr.substring(0, 2000)}"

Respond with ONLY the category name, nothing else. The category must be exactly one of the options listed above.`;

  logger.info('[AICategorize] Categorizing:', {
    field: aiConfig.field_to_analyze,
    categories: aiConfig.categories,
    textLength: textStr.length,
  });
  
  try {
    // Get API key
    const supabase = await createServerSupabaseClient();
    const apiKey = await getGeminiApiKey(supabase);
    
    if (!apiKey) {
      logger.error('[AICategorize] Gemini API key not configured');
      throw new Error('Gemini API key not configured');
    }
    
    const result = await generateAIResponse(prompt, {}, apiKey) as string;
    const category = result.trim();
    
    // Validate the category is in the list
    const matchedCategory = aiConfig.categories.find(
      c => c.toLowerCase() === category.toLowerCase()
    );
    
    if (!matchedCategory) {
      logger.warn('[AICategorize] AI returned invalid category:', {
        returned: category,
        valid: aiConfig.categories,
      });
    }
    
    logger.info('[AICategorize] Categorization complete:', {
      category: matchedCategory || category,
      field: aiConfig.field_to_analyze,
    });
    
    return {
      output: {
        success: true,
        [aiConfig.output_field]: matchedCategory || category,
        analyzed_text: textStr.substring(0, 100) + (textStr.length > 100 ? '...' : ''),
        categorized_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[AICategorize] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute AI summarize action
 * 
 * @param config - AI summarization configuration
 * @param context - Workflow context
 * @returns Action result with summary
 */
export async function executeAISummarize(
  config: AISummarizeConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const aiConfig = config as AISummarizeConfig;
  
  // Get the text to summarize from context
  const textToSummarize = getNestedValue(context, aiConfig.field_to_summarize);
  
  if (!textToSummarize) {
    logger.warn('[AISummarize] No text found to summarize:', {
      field: aiConfig.field_to_summarize,
    });
    return {
      output: {
        success: false,
        skipped: true,
        reason: `No text found at ${aiConfig.field_to_summarize}`,
        [aiConfig.output_field]: null,
      },
    };
  }
  
  const textStr = typeof textToSummarize === 'string' 
    ? textToSummarize 
    : JSON.stringify(textToSummarize);
  
  const maxLength = aiConfig.max_length || 500;
  
  // Build summarization prompt
  const prompt = `Summarize the following text in ${maxLength} characters or less. Be concise and capture the key points.

Text: "${textStr.substring(0, 5000)}"

Summary:`;

  logger.info('[AISummarize] Summarizing:', {
    field: aiConfig.field_to_summarize,
    textLength: textStr.length,
    maxLength,
  });
  
  try {
    // Get API key
    const supabase = await createServerSupabaseClient();
    const apiKey = await getGeminiApiKey(supabase);
    
    if (!apiKey) {
      logger.error('[AISummarize] Gemini API key not configured');
      throw new Error('Gemini API key not configured');
    }
    
    const summary = await generateAIResponse(prompt, {}, apiKey) as string;
    
    logger.info('[AISummarize] Summarization complete:', {
      summaryLength: summary.length,
      field: aiConfig.field_to_summarize,
    });
    
    return {
      output: {
        success: true,
        [aiConfig.output_field]: summary.trim(),
        original_length: textStr.length,
        summary_length: summary.trim().length,
        summarized_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[AISummarize] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

