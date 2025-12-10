/**
 * AI Clarity Spec Analyzer
 * Analyzes clarity specs for completeness and provides suggestions
 */

import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ClaritySpec, ClarityAnalysisResult } from '@/types/workspace';

/**
 * Calculate completeness score for each section
 */
function calculateSectionCompleteness(spec: ClaritySpec): {
  problem_framing: number;
  business_intent: number;
  outcomes: number;
} {
  // Problem Framing (0-10)
  let problemFraming = 0;
  if (spec.problem_statement && spec.problem_statement.length > 50) problemFraming += 4;
  if (spec.jobs_to_be_done && spec.jobs_to_be_done.length > 0) problemFraming += 3;
  if (spec.user_pains && spec.user_pains.length > 0) problemFraming += 3;

  // Business Intent (0-10)
  let businessIntent = 0;
  if (spec.business_goals && spec.business_goals.length > 0) businessIntent += 3;
  if (spec.success_metrics && spec.success_metrics.length > 0) businessIntent += 4;
  if (spec.constraints && spec.constraints.length > 0) businessIntent += 2;
  if (spec.assumptions && spec.assumptions.length > 0) businessIntent += 1;

  // Outcomes (0-10)
  let outcomes = 0;
  if (spec.desired_outcomes && spec.desired_outcomes.length > 0) outcomes += 6;
  if (spec.mental_model_notes && spec.mental_model_notes.length > 50) outcomes += 2;
  if (spec.stakeholder_notes && spec.stakeholder_notes.length > 50) outcomes += 2;

  return {
    problem_framing: Math.min(10, problemFraming),
    business_intent: Math.min(10, businessIntent),
    outcomes: Math.min(10, outcomes),
  };
}

/**
 * Generate risk warnings based on missing or weak content
 */
function generateRiskWarnings(spec: ClaritySpec, completeness: ReturnType<typeof calculateSectionCompleteness>): string[] {
  const warnings: string[] = [];

  // Critical warnings
  if (!spec.problem_statement || spec.problem_statement.length < 50) {
    warnings.push('Missing or insufficient problem statement - cannot proceed without clear problem definition');
  }

  if (!spec.success_metrics || spec.success_metrics.length === 0) {
    warnings.push('No success metrics defined - unable to measure if solution addresses the problem');
  }

  if (!spec.desired_outcomes || spec.desired_outcomes.length === 0) {
    warnings.push('No desired outcomes specified - team will lack clear direction');
  }

  // Medium priority warnings
  if (!spec.jobs_to_be_done || spec.jobs_to_be_done.length === 0) {
    warnings.push('Jobs-to-be-done not captured - may miss user context');
  }

  if (!spec.business_goals || spec.business_goals.length === 0) {
    warnings.push('Business goals not defined - difficult to align with company objectives');
  }

  if (!spec.constraints || spec.constraints.length === 0) {
    warnings.push('No constraints documented - may plan unrealistic solutions');
  }

  // Low priority warnings
  if (!spec.user_pains || spec.user_pains.length === 0) {
    warnings.push('User pains not documented - solution may not address root causes');
  }

  if (!spec.assumptions || spec.assumptions.length === 0) {
    warnings.push('No assumptions listed - hidden risks not surfaced');
  }

  return warnings;
}

/**
 * Analyze clarity spec using AI to provide intelligent suggestions
 */
export async function analyzeClaritySpec(
  spec: ClaritySpec,
  apiKey?: string
): Promise<ClarityAnalysisResult> {
  try {
    logger.info('[Clarity Analyzer] Starting analysis:', {
      specId: spec.id,
      version: spec.version,
    });

    // Calculate section completeness
    const completeness = calculateSectionCompleteness(spec);

    // Calculate overall readiness score (weighted average)
    const readinessScore = Math.round(
      (completeness.problem_framing * 0.4 +
        completeness.business_intent * 0.35 +
        completeness.outcomes * 0.25) * 10
    ) / 10;

    // Generate rule-based risk warnings
    const ruleBasedWarnings = generateRiskWarnings(spec, completeness);

    // Build AI prompt for intelligent suggestions
    const prompt = `You are a product management expert analyzing a product clarity specification. Your goal is to provide actionable suggestions for improvement.

**Clarity Spec Details:**

Problem Statement: ${spec.problem_statement || '(Not provided)'}

Jobs to Be Done:
${spec.jobs_to_be_done && spec.jobs_to_be_done.length > 0 ? spec.jobs_to_be_done.map((job, i) => `${i + 1}. ${job}`).join('\n') : '(None listed)'}

User Pains:
${spec.user_pains && spec.user_pains.length > 0 ? spec.user_pains.map((pain, i) => `${i + 1}. ${pain}`).join('\n') : '(None listed)'}

Business Goals:
${spec.business_goals && spec.business_goals.length > 0 ? spec.business_goals.map((goal, i) => `${i + 1}. ${goal}`).join('\n') : '(None listed)'}

Success Metrics:
${spec.success_metrics && spec.success_metrics.length > 0 ? spec.success_metrics.map((metric, i) => `${i + 1}. ${metric}`).join('\n') : '(None listed)'}

Constraints:
${spec.constraints && spec.constraints.length > 0 ? spec.constraints.map((constraint, i) => `${i + 1}. ${constraint}`).join('\n') : '(None listed)'}

Assumptions:
${spec.assumptions && spec.assumptions.length > 0 ? spec.assumptions.map((assumption, i) => `${i + 1}. ${assumption}`).join('\n') : '(None listed)'}

Desired Outcomes:
${spec.desired_outcomes && spec.desired_outcomes.length > 0 ? spec.desired_outcomes.map((outcome, i) => `${i + 1}. ${outcome}`).join('\n') : '(None listed)'}

Mental Model Notes: ${spec.mental_model_notes || '(Not provided)'}

**Current Completeness Scores:**
- Problem Framing: ${completeness.problem_framing}/10
- Business Intent: ${completeness.business_intent}/10
- Outcomes: ${completeness.outcomes}/10

**Your Task:**
Provide 3-5 specific, actionable suggestions to improve this clarity spec. Focus on:
1. Strengthening weak areas
2. Adding missing critical information
3. Improving clarity and specificity
4. Ensuring alignment between problem, goals, and outcomes
5. Identifying assumptions that should be validated

Return your analysis as JSON with this structure:
{
  "suggestions": [
    "Specific suggestion 1...",
    "Specific suggestion 2...",
    ...
  ],
  "additional_warnings": [
    "Optional: Any critical gaps not covered by standard warnings..."
  ]
}`;

    // Call AI for intelligent suggestions
    let aiSuggestions: string[] = [];
    let additionalWarnings: string[] = [];

    try {
      const aiResponse = await generateStructuredAIResponse<{
        suggestions: string[];
        additional_warnings?: string[];
      }>(prompt, {}, apiKey, undefined, false) as {
        suggestions: string[];
        additional_warnings?: string[];
      };

      aiSuggestions = aiResponse.suggestions || [];
      additionalWarnings = aiResponse.additional_warnings || [];

      logger.info('[Clarity Analyzer] AI analysis successful:', {
        suggestionsCount: aiSuggestions.length,
        additionalWarningsCount: additionalWarnings.length,
      });
    } catch (aiError) {
      logger.warn('[Clarity Analyzer] AI analysis failed, using rule-based only:', aiError);
      // Fallback to rule-based suggestions
      aiSuggestions = generateFallbackSuggestions(spec, completeness);
    }

    // Combine warnings
    const allWarnings = [...ruleBasedWarnings, ...additionalWarnings];

    const result: ClarityAnalysisResult = {
      readiness_score: readinessScore,
      risk_warnings: allWarnings,
      suggestions: aiSuggestions,
      completeness,
    };

    logger.info('[Clarity Analyzer] Analysis complete:', {
      specId: spec.id,
      readinessScore,
      warningsCount: allWarnings.length,
      suggestionsCount: aiSuggestions.length,
    });

    return result;
  } catch (error) {
    logger.error('[Clarity Analyzer] Analysis failed:', error);
    
    // Return basic analysis on error
    const completeness = calculateSectionCompleteness(spec);
    const readinessScore = Math.round(
      (completeness.problem_framing * 0.4 +
        completeness.business_intent * 0.35 +
        completeness.outcomes * 0.25) * 10
    ) / 10;

    return {
      readiness_score: readinessScore,
      risk_warnings: generateRiskWarnings(spec, completeness),
      suggestions: generateFallbackSuggestions(spec, completeness),
      completeness,
    };
  }
}

/**
 * Generate fallback suggestions when AI is unavailable
 */
function generateFallbackSuggestions(
  spec: ClaritySpec,
  completeness: ReturnType<typeof calculateSectionCompleteness>
): string[] {
  const suggestions: string[] = [];

  // Problem Framing suggestions
  if (completeness.problem_framing < 7) {
    if (!spec.problem_statement || spec.problem_statement.length < 100) {
      suggestions.push('Expand the problem statement to clearly articulate what problem you are solving and why it matters');
    }
    if (!spec.jobs_to_be_done || spec.jobs_to_be_done.length < 2) {
      suggestions.push('Add at least 2-3 jobs-to-be-done to understand what users are trying to accomplish');
    }
    if (!spec.user_pains || spec.user_pains.length < 2) {
      suggestions.push('Document specific user pains to ensure the solution addresses real frustrations');
    }
  }

  // Business Intent suggestions
  if (completeness.business_intent < 7) {
    if (!spec.business_goals || spec.business_goals.length === 0) {
      suggestions.push('Define business goals to align the solution with company objectives (e.g., increase revenue, reduce churn, improve efficiency)');
    }
    if (!spec.success_metrics || spec.success_metrics.length === 0) {
      suggestions.push('Add measurable success metrics (e.g., "Increase conversion by 20%", "Reduce support tickets by 30%")');
    }
    if (!spec.constraints || spec.constraints.length === 0) {
      suggestions.push('Document constraints (budget, timeline, technical limitations) to set realistic expectations');
    }
  }

  // Outcomes suggestions
  if (completeness.outcomes < 7) {
    if (!spec.desired_outcomes || spec.desired_outcomes.length < 2) {
      suggestions.push('Specify 2-3 desired outcomes that describe the end state after the solution is implemented');
    }
    if (!spec.mental_model_notes || spec.mental_model_notes.length < 50) {
      suggestions.push('Add mental model notes to capture shared understanding and key insights from stakeholder discussions');
    }
  }

  // Always suggest reviewing assumptions
  if (!spec.assumptions || spec.assumptions.length === 0) {
    suggestions.push('List key assumptions that need validation before committing to a solution');
  }

  // Limit to 5 suggestions
  return suggestions.slice(0, 5);
}
