import logger from '@/lib/utils/logger';
import type { ProjectTask } from '@/types/project';
import type { PreviewTask, DuplicateStatus } from '@/types/taskGenerator';
import { generateStructuredAIResponse, type AIResponseWithMetadata, type GeminiModel } from './geminiClient';

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Calculate Jaccard similarity (token-based)
 */
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/).filter((t) => t.length > 0));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/).filter((t) => t.length > 0));

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

/**
 * Calculate string-based similarity between two tasks
 * Combines title and description similarity
 */
export function calculateStringSimilarity(
  task1: { title: string; description: string | null },
  task2: { title: string; description: string | null }
): number {
  const title1 = task1.title || '';
  const title2 = task2.title || '';
  const desc1 = task1.description || '';
  const desc2 = task2.description || '';

  // Calculate title similarity (weighted 60%)
  const titleLevenshtein = calculateLevenshteinSimilarity(title1, title2);
  const titleJaccard = calculateJaccardSimilarity(title1, title2);
  const titleSimilarity = (titleLevenshtein * 0.5 + titleJaccard * 0.5) * 0.6;

  // Calculate description similarity (weighted 40%)
  let descSimilarity = 0;
  if (desc1 && desc2) {
    const descLevenshtein = calculateLevenshteinSimilarity(desc1, desc2);
    const descJaccard = calculateJaccardSimilarity(desc1, desc2);
    descSimilarity = (descLevenshtein * 0.5 + descJaccard * 0.5) * 0.4;
  }

  return titleSimilarity + descSimilarity;
}

/**
 * Calculate semantic similarity using AI
 * Uses Gemini to compare task meanings
 * @returns similarity score and metadata
 */
export async function calculateSemanticSimilarity(
  task1: { title: string; description: string | null },
  task2: { title: string; description: string | null },
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash-lite'
): Promise<{ similarity: number; metadata?: AIResponseWithMetadata['metadata'] }> {
  const prompt = `Compare these two tasks and determine how similar they are semantically (meaning, not just wording).

Task 1:
Title: ${task1.title}
Description: ${task1.description || 'No description'}

Task 2:
Title: ${task2.title}
Description: ${task2.description || 'No description'}

Rate their similarity on a scale of 0.0 to 1.0 where:
- 1.0 = Exactly the same task (duplicate)
- 0.9-0.99 = Very similar, likely the same task with different wording
- 0.7-0.89 = Similar tasks, possibly related but not duplicates
- 0.5-0.69 = Somewhat related but different tasks
- 0.0-0.49 = Different tasks

Return ONLY a JSON object with this format:
{
  "similarity": 0.85,
  "reason": "Brief explanation"
}`;

  try {
    const result = await generateStructuredAIResponse<{
      similarity: number;
      reason?: string;
    }>(
      prompt,
      {},
      apiKey,
      undefined,
      true, // returnMetadata
      model
    );

    // Handle both wrapped and unwrapped results
    let similarityResult: { similarity: number; reason?: string };
    let metadata: AIResponseWithMetadata['metadata'] | undefined;

    if (typeof result === 'object' && result !== null && 'result' in result && 'metadata' in result) {
      similarityResult = (result as { result: { similarity: number; reason?: string }; metadata: AIResponseWithMetadata['metadata'] }).result;
      metadata = (result as { result: { similarity: number; reason?: string }; metadata: AIResponseWithMetadata['metadata'] }).metadata;
    } else if (typeof result === 'object' && result !== null && 'result' in result) {
      similarityResult = (result as { result: { similarity: number; reason?: string } }).result;
    } else {
      similarityResult = result as { similarity: number; reason?: string };
    }

    // Clamp similarity to 0-1 range
    return {
      similarity: Math.max(0, Math.min(1, similarityResult.similarity || 0)),
      metadata,
    };
  } catch (error) {
    logger.error('[Task Similarity] Error calculating semantic similarity:', error);
    // Fallback to string similarity if AI fails
    return {
      similarity: calculateStringSimilarity(task1, task2),
    };
  }
}

/**
 * Detect duplicates for new tasks against existing tasks
 * Uses hybrid approach: string similarity first, then AI semantic similarity
 * @returns tasks with duplicate status and accumulated metadata
 */
export async function detectDuplicates(
  newTasks: PreviewTask[],
  existingTasks: ProjectTask[],
  apiKey: string
): Promise<{ tasks: PreviewTask[]; metadata?: AIResponseWithMetadata['metadata'] }> {
  const results: PreviewTask[] = [];
  const metadataAccumulator: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
    response_time_ms: number;
    calls: number;
  } = {
    total_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost: 0,
    response_time_ms: 0,
    calls: 0,
  };

  for (const newTask of newTasks) {
    let bestMatch: { task: ProjectTask; similarity: number } | null = null;
    let bestStringSimilarity = 0;

    // Step 1: String similarity filtering (70%+ threshold)
    const candidates: Array<{ task: ProjectTask; stringSimilarity: number }> = [];

    for (const existingTask of existingTasks) {
      const stringSim = calculateStringSimilarity(newTask, existingTask);
      if (stringSim >= 0.7) {
        candidates.push({ task: existingTask, stringSimilarity: stringSim });
        if (stringSim > bestStringSimilarity) {
          bestStringSimilarity = stringSim;
        }
      }
    }

    // Step 2: If candidates found, use AI semantic similarity
    if (candidates.length > 0) {
      // Sort by string similarity (descending) and check top candidates
      candidates.sort((a, b) => b.stringSimilarity - a.stringSimilarity);
      
      // Check top 3 candidates with AI (to avoid too many API calls)
      for (const candidate of candidates.slice(0, 3)) {
        try {
          const result = await calculateSemanticSimilarity(
            newTask,
            candidate.task,
            apiKey,
            'gemini-2.5-flash-lite' // Use Flash-Lite for simple comparison
          );

          // Accumulate metadata
          if (result.metadata) {
            metadataAccumulator.calls++;
            metadataAccumulator.input_tokens += result.metadata.input_tokens || 0;
            metadataAccumulator.output_tokens += result.metadata.output_tokens || 0;
            metadataAccumulator.total_tokens += result.metadata.total_tokens || 0;
            metadataAccumulator.estimated_cost += result.metadata.estimated_cost || 0;
            metadataAccumulator.response_time_ms += result.metadata.response_time_ms || 0;
          }

          // Combine string and semantic similarity (weighted average)
          const combinedSimilarity = candidate.stringSimilarity * 0.3 + result.similarity * 0.7;

          if (!bestMatch || combinedSimilarity > bestMatch.similarity) {
            bestMatch = { task: candidate.task, similarity: combinedSimilarity };
          }
        } catch (error) {
          logger.warn('[Task Similarity] Error in semantic comparison, using string similarity:', error);
          // Fallback to string similarity
          if (!bestMatch || candidate.stringSimilarity > bestMatch.similarity) {
            bestMatch = { task: candidate.task, similarity: candidate.stringSimilarity };
          }
        }
      }
    }

    // Step 3: Classify duplicate status
    let duplicateStatus: DuplicateStatus = 'unique';
    let existingTaskId: string | null = null;

    if (bestMatch) {
      if (bestMatch.similarity >= 0.9) {
        duplicateStatus = 'exact-duplicate';
        existingTaskId = bestMatch.task.id;
      } else if (bestMatch.similarity >= 0.7) {
        duplicateStatus = 'possible-duplicate';
        existingTaskId = bestMatch.task.id;
      }
    }

    results.push({
      ...newTask,
      duplicateStatus,
      existingTaskId,
    });
  }

  // Return tasks with accumulated metadata (if any AI calls were made)
  const metadata: AIResponseWithMetadata['metadata'] | undefined = metadataAccumulator.calls > 0 ? {
    prompt_length: 0,
    full_prompt_length: 0,
    response_length: 0,
    model: 'gemini-2.5-flash-lite',
    response_time_ms: metadataAccumulator.response_time_ms,
    input_tokens: metadataAccumulator.input_tokens,
    output_tokens: metadataAccumulator.output_tokens,
    total_tokens: metadataAccumulator.total_tokens,
    estimated_cost: metadataAccumulator.estimated_cost,
  } : undefined;

  return {
    tasks: results,
    metadata,
  };
}

