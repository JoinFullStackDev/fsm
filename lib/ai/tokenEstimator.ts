/**
 * Token estimation utility for Gemini API
 * Used when token counts are not available from the API response
 */

import type { PhaseDataUnion } from '@/types/phases';
import type { Project } from '@/types/project';

// Project data type that can be either the full Project type or a partial
type ProjectDataType = Project | Partial<Project> | Record<string, unknown>;

/**
 * Estimate token count from text
 * Rough estimation: 1 token ≈ 4 characters for English text
 * This is a conservative estimate - actual tokenization varies
 * 
 * @param text - The text to estimate tokens for
 * @param model - The model name (for model-specific adjustments)
 * @returns Estimated token count
 */
export function estimateTokens(text: string, model: string = 'gemini-2.5-flash'): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Base estimation: ~4 characters per token for English
  // This is a rough approximation - actual tokenization can vary
  const baseEstimate = Math.ceil(text.length / 4);

  // Model-specific adjustments
  // Gemini models tend to tokenize similarly, but we can adjust if needed
  if (model.includes('gemini')) {
    // Gemini models: slightly more efficient tokenization
    // Adjust by ~5% more tokens (more conservative)
    return Math.ceil(baseEstimate * 1.05);
  }

  return baseEstimate;
}

/**
 * Estimate input tokens from prompt and context
 */
export function estimateInputTokens(
  prompt: string,
  context?: string,
  phaseData?: PhaseDataUnion,
  projectData?: ProjectDataType,
  previousPhases?: PhaseDataUnion[]
): number {
  let totalChars = prompt.length;

  if (context) {
    totalChars += context.length;
  }

  if (phaseData) {
    totalChars += JSON.stringify(phaseData).length;
  }

  if (projectData) {
    totalChars += JSON.stringify(projectData).length;
  }

  if (previousPhases && previousPhases.length > 0) {
    totalChars += JSON.stringify(previousPhases).length;
  }

  return estimateTokens(prompt + (context || '') + JSON.stringify(phaseData || {}) + JSON.stringify(projectData || {}) + JSON.stringify(previousPhases || []));
}

/**
 * Estimate output tokens from response text
 */
export function estimateOutputTokens(responseText: string, model: string = 'gemini-2.5-flash'): number {
  return estimateTokens(responseText, model);
}

