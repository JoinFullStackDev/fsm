/**
 * Cost calculation utility for Gemini API usage
 * Based on current Gemini 2.5 Flash pricing
 */

/**
 * Gemini 2.5 Flash pricing (as of 2024)
 * These rates should be updated if Google changes pricing
 */
const GEMINI_2_5_FLASH_PRICING = {
  input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens
  output: 0.30 / 1_000_000,  // $0.30 per 1M output tokens
};

/**
 * Gemini 2.5 Flash-Lite pricing (as of 2024)
 * Approximately 50% cheaper than Flash
 */
const GEMINI_2_5_FLASH_LITE_PRICING = {
  input: 0.0375 / 1_000_000,  // ~$0.0375 per 1M input tokens
  output: 0.15 / 1_000_000,   // ~$0.15 per 1M output tokens
};

/**
 * Calculate AI cost based on token usage
 * Falls back to character-based estimation if tokens not provided
 * 
 * @param model - The model name
 * @param inputTokens - Input token count (optional)
 * @param outputTokens - Output token count (optional)
 * @param promptChars - Prompt character count (fallback if tokens unavailable)
 * @param responseChars - Response character count (fallback if tokens unavailable)
 * @returns Estimated cost in USD
 */
export function calculateAICost(
  model: string,
  inputTokens?: number,
  outputTokens?: number,
  promptChars?: number,
  responseChars?: number
): number {
  // Use token-based calculation if available (more accurate)
  if (inputTokens !== undefined && outputTokens !== undefined) {
    if (model.includes('gemini-2.5-flash-lite')) {
      const inputCost = inputTokens * GEMINI_2_5_FLASH_LITE_PRICING.input;
      const outputCost = outputTokens * GEMINI_2_5_FLASH_LITE_PRICING.output;
      return inputCost + outputCost;
    }
    
    if (model.includes('gemini-2.5-flash') || model.includes('gemini-2.0-flash')) {
      const inputCost = inputTokens * GEMINI_2_5_FLASH_PRICING.input;
      const outputCost = outputTokens * GEMINI_2_5_FLASH_PRICING.output;
      return inputCost + outputCost;
    }
    
    // Default to 2.5 Flash pricing for unknown Gemini models
    const inputCost = inputTokens * GEMINI_2_5_FLASH_PRICING.input;
    const outputCost = outputTokens * GEMINI_2_5_FLASH_PRICING.output;
    return inputCost + outputCost;
  }

  // Fallback to character-based estimation
  // Rough estimate: 1 token ≈ 4 characters
  if (promptChars !== undefined && responseChars !== undefined) {
    const estimatedInputTokens = Math.ceil(promptChars / 4);
    const estimatedOutputTokens = Math.ceil(responseChars / 4);
    
    if (model.includes('gemini-2.5-flash-lite')) {
      const inputCost = estimatedInputTokens * GEMINI_2_5_FLASH_LITE_PRICING.input;
      const outputCost = estimatedOutputTokens * GEMINI_2_5_FLASH_LITE_PRICING.output;
      return inputCost + outputCost;
    }
    
    if (model.includes('gemini-2.5-flash') || model.includes('gemini-2.0-flash')) {
      const inputCost = estimatedInputTokens * GEMINI_2_5_FLASH_PRICING.input;
      const outputCost = estimatedOutputTokens * GEMINI_2_5_FLASH_PRICING.output;
      return inputCost + outputCost;
    }
    
    // Default to 2.5 Flash pricing
    const inputCost = estimatedInputTokens * GEMINI_2_5_FLASH_PRICING.input;
    const outputCost = estimatedOutputTokens * GEMINI_2_5_FLASH_PRICING.output;
    return inputCost + outputCost;
  }

  // If no data available, return 0
  return 0;
}

/**
 * Get pricing information for a model
 */
export function getModelPricing(model: string): { input: number; output: number } | null {
  if (model.includes('gemini-2.5-flash-lite')) {
    return GEMINI_2_5_FLASH_LITE_PRICING;
  }
  
  if (model.includes('gemini-2.5-flash') || model.includes('gemini-2.0-flash')) {
    return GEMINI_2_5_FLASH_PRICING;
  }
  
  // Default to 2.5 Flash pricing for unknown models
  return GEMINI_2_5_FLASH_PRICING;
}

