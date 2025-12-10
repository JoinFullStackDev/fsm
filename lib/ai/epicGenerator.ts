/**
 * AI Epic Generator
 * Generates epic descriptions and issues from clarity specs
 */

import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ClaritySpec, EpicGenerationResult, IssueDefinition } from '@/types/workspace';

/**
 * Generate epic from clarity spec using AI
 */
export async function generateEpicFromClarity(
  spec: ClaritySpec,
  apiKey?: string
): Promise<EpicGenerationResult> {
  try {
    logger.info('[Epic Generator] Starting epic generation:', {
      specId: spec.id,
      version: spec.version,
    });

    // Build comprehensive prompt with enhanced instructions for better output
    const prompt = `You are a senior product manager and technical architect with 15+ years of experience decomposing complex product requirements into executable engineering work. Your specialty is creating comprehensive, well-structured epics that engineering teams can immediately act on.

**INPUT - Product Clarity Specification:**

**Problem Statement:**
${spec.problem_statement || '(Not provided)'}

**Jobs to Be Done:**
${spec.jobs_to_be_done && spec.jobs_to_be_done.length > 0 
  ? spec.jobs_to_be_done.map((job, i) => `${i + 1}. ${job}`).join('\n') 
  : '(None listed)'}

**User Pains:**
${spec.user_pains && spec.user_pains.length > 0 
  ? spec.user_pains.map((pain, i) => `${i + 1}. ${pain}`).join('\n') 
  : '(None listed)'}

**Business Goals:**
${spec.business_goals && spec.business_goals.length > 0 
  ? spec.business_goals.map((goal, i) => `${i + 1}. ${goal}`).join('\n') 
  : '(None listed)'}

**Success Metrics:**
${spec.success_metrics && spec.success_metrics.length > 0 
  ? spec.success_metrics.map((metric, i) => `${i + 1}. ${metric}`).join('\n') 
  : '(None listed)'}

**Constraints:**
${spec.constraints && spec.constraints.length > 0 
  ? spec.constraints.map((constraint, i) => `${i + 1}. ${constraint}`).join('\n') 
  : '(None listed)'}

**Assumptions:**
${spec.assumptions && spec.assumptions.length > 0 
  ? spec.assumptions.map((assumption, i) => `${i + 1}. ${assumption}`).join('\n') 
  : '(None listed)'}

**Desired Outcomes:**
${spec.desired_outcomes && spec.desired_outcomes.length > 0 
  ? spec.desired_outcomes.map((outcome, i) => `${i + 1}. ${outcome}`).join('\n') 
  : '(None listed)'}

${spec.mental_model_notes ? `\n**Mental Model Notes:**\n${spec.mental_model_notes}\n` : ''}
${spec.stakeholder_notes ? `\n**Stakeholder Notes:**\n${spec.stakeholder_notes}\n` : ''}

---

**YOUR TASK - Generate a Production-Ready Epic:**

Create a comprehensive, well-structured Epic that an engineering team can immediately execute on. Be thorough, specific, and actionable.

**1. Epic Title** (required)
- Clear, action-oriented title (40-60 characters)
- Should communicate the business value, not just the feature
- Examples: "Rebuild User Navigation for Use-Case Discovery", "Implement Real-Time Collaboration Infrastructure"

**2. Epic Description** (required, 300-800 words)
Write a comprehensive epic description following this structure:

**Problem & Context:**
- What problem are we solving and why does it matter?
- What pain points are users experiencing?
- What business impact does this have?

**Proposed Solution:**
- High-level technical approach
- Key architectural decisions
- Integration points with existing systems

**Business Value:**
- Which business goals this addresses
- Expected impact on success metrics
- Why this is important now

**Scope & Boundaries:**
- What's included in this epic
- What's explicitly out of scope
- Key dependencies

**3. Frontend Issues** (5-12 issues)
Create detailed, executable frontend tasks. Each issue must include:
- **Title**: Action-oriented, specific (e.g., "Build responsive product comparison modal with filtering")
- **Description** (100-200 words): 
  - What needs to be built
  - User experience considerations
  - UI/UX requirements
  - Component structure if applicable
  - State management approach
  - Mobile/responsive considerations
- **Acceptance Criteria**: 4-6 specific, testable criteria (not vague)
- **Estimated Hours**: 2-24 hours (be realistic - complex UI work takes time)
- **Priority**: high (must-have), medium (should-have), or low (nice-to-have)

**4. Backend Issues** (5-12 issues)
Create detailed, executable backend tasks. Each issue must include:
- **Title**: Action-oriented, specific (e.g., "Design and implement product taxonomy database schema")
- **Description** (100-200 words):
  - Data model changes needed
  - API endpoints to create/modify
  - Business logic requirements
  - Authentication/authorization considerations
  - Performance requirements
  - Error handling approach
- **Acceptance Criteria**: 4-6 specific, testable criteria
- **Estimated Hours**: 2-24 hours
- **Priority**: high, medium, or low

**5. Design Issues** (0-5 issues, only if truly needed)
Only include design issues if they're critical path (e.g., wireframes needed before frontend work can start). Each must include:
- **Title**: What design deliverable is needed
- **Description**: Design requirements, user flows, prototype needs
- **Acceptance Criteria**: Design review criteria
- **Estimated Hours**: 2-16 hours
- **Priority**: typically high (design blocks other work)

**6. Definition of Done** (5-8 criteria)
Be comprehensive and specific:
- Code quality requirements (tests, coverage, code review)
- Documentation requirements (API docs, README updates, inline comments)
- Performance requirements (load times, query performance)
- Security requirements (if applicable)
- Deployment requirements (staging tested, production ready)
- Acceptance testing completed by PM
- Success metrics instrumented and validated

**7. Value Tags** (3-5 tags)
Categorize the business value:
- Impact type: "revenue-impact", "user-satisfaction", "operational-efficiency", "strategic-foundation"
- Value tier: "quick-win", "high-impact", "long-term-value"
- Risk/reward: "low-risk-high-reward", "calculated-risk", "technical-investment"

**8. Risk Level** (required)
Assess realistically:
- **low**: Well-understood work, minimal dependencies, low complexity
- **medium**: Some unknowns, moderate dependencies, medium complexity
- **high**: Significant unknowns, many dependencies, high complexity
- **critical**: High uncertainty, blockers, architectural changes, or tight timeline

**9. Effort Estimate** (required)
Be specific and realistic:
- Include developer time + review time + testing time
- Examples: "3-4 weeks (2 engineers)", "1 sprint (4 engineers)", "6-8 weeks (full team)"

**QUALITY STANDARDS:**
- Issues should be 80% ready for development (minimal clarification needed)
- Acceptance criteria must be specific enough to write tests against
- Descriptions should answer "what", "why", and "how" clearly
- Estimates should account for code review, testing, and refinement
- Frontend and backend issues should reference each other where coupled
- Include technical debt considerations in descriptions
- Call out dependencies between issues explicitly

**CRITICAL OUTPUT REQUIREMENTS:**

You MUST generate a complete, production-ready epic. Do NOT provide placeholder or incomplete responses.

Required minimums:
- Epic description: At least 300 words covering all sections (Problem, Solution, Business Value, Scope)
- Frontend issues: At least 5 detailed issues
- Backend issues: At least 5 detailed issues
- Each issue description: At least 100 words
- Each issue: At least 4 acceptance criteria
- Definition of Done: At least 5 criteria
- Value tags: At least 3 tags

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "Action-oriented epic title that communicates business value (40-60 chars)",
  "description": "COMPREHENSIVE epic description (300-800 words) that covers:\n\n**Problem & Context:**\n[Explain the problem, user pains, business impact]\n\n**Proposed Solution:**\n[Technical approach, architecture, integrations]\n\n**Business Value:**\n[Goals addressed, metric impact, strategic importance]\n\n**Scope & Boundaries:**\n[What's included, what's excluded, dependencies]",
  "frontend_issues": [
    {
      "title": "Specific, actionable frontend task title",
      "description": "Detailed description (100-200 words) covering: what to build, UX considerations, component structure, state management, responsive design, accessibility",
      "acceptance_criteria": [
        "Specific testable criterion 1",
        "Specific testable criterion 2",
        "Specific testable criterion 3",
        "Specific testable criterion 4"
      ],
      "estimated_hours": 8,
      "priority": "high"
    }
  ],
  "backend_issues": [
    {
      "title": "Specific, actionable backend task title",
      "description": "Detailed description (100-200 words) covering: data model changes, API endpoints, business logic, auth/permissions, performance, error handling",
      "acceptance_criteria": [
        "Specific testable criterion 1",
        "Specific testable criterion 2",
        "Specific testable criterion 3",
        "Specific testable criterion 4"
      ],
      "estimated_hours": 12,
      "priority": "high"
    }
  ],
  "design_issues": [
    {
      "title": "Design deliverable needed (only if critical path)",
      "description": "Design requirements and deliverables",
      "acceptance_criteria": ["Design criterion 1", "Design criterion 2"],
      "estimated_hours": 4,
      "priority": "high"
    }
  ],
  "definition_of_done": [
    "All unit tests passing with >80% coverage",
    "Integration tests cover critical paths",
    "API documentation updated in OpenAPI spec",
    "Code reviewed and approved by tech lead",
    "Performance benchmarks met (load time <2s)",
    "Security review completed (if applicable)",
    "Staging environment tested and approved by PM",
    "Production deployment plan documented"
  ],
  "value_tags": ["revenue-impact", "user-satisfaction", "quick-win", "strategic-foundation"],
  "risk_level": "medium",
  "effort_estimate": "3-4 weeks with 2 full-stack engineers"
}

GENERATE A COMPLETE, HIGH-QUALITY EPIC NOW. NO PLACEHOLDERS. NO SHORTCUTS.`;

    // Call AI for epic generation
    const generated = await generateStructuredAIResponse<{
      title: string;
      description: string;
      frontend_issues: IssueDefinition[];
      backend_issues: IssueDefinition[];
      design_issues?: IssueDefinition[];
      definition_of_done: string[];
      value_tags: string[];
      risk_level: 'low' | 'medium' | 'high' | 'critical';
      effort_estimate: string;
    }>(prompt, {}, apiKey, undefined, false) as {
      title: string;
      description: string;
      frontend_issues: IssueDefinition[];
      backend_issues: IssueDefinition[];
      design_issues?: IssueDefinition[];
      definition_of_done: string[];
      value_tags: string[];
      risk_level: 'low' | 'medium' | 'high' | 'critical';
      effort_estimate: string;
    };

    // Log raw AI response for debugging
    logger.info('[Epic Generator] Raw AI response:', {
      titleLength: generated.title?.length || 0,
      descriptionLength: generated.description?.length || 0,
      frontendCount: generated.frontend_issues?.length || 0,
      backendCount: generated.backend_issues?.length || 0,
      dodCount: generated.definition_of_done?.length || 0,
    });

    // Validate response meets minimum quality standards
    const validationErrors: string[] = [];

    if (!generated.title || generated.title.length < 10) {
      validationErrors.push('Title too short or missing');
    }

    if (!generated.description || generated.description.length < 200) {
      validationErrors.push(`Description too short (${generated.description?.length || 0} chars, need at least 200)`);
    }

    if (!generated.frontend_issues || generated.frontend_issues.length < 3) {
      validationErrors.push(`Not enough frontend issues (${generated.frontend_issues?.length || 0}, need at least 3)`);
    }

    if (!generated.backend_issues || generated.backend_issues.length < 3) {
      validationErrors.push(`Not enough backend issues (${generated.backend_issues?.length || 0}, need at least 3)`);
    }

    if (!generated.definition_of_done || generated.definition_of_done.length < 5) {
      validationErrors.push(`Not enough DoD criteria (${generated.definition_of_done?.length || 0}, need at least 5)`);
    }

    if (validationErrors.length > 0) {
      logger.error('[Epic Generator] AI response failed validation:', {
        errors: validationErrors,
        response: generated,
      });
      throw new Error(`AI generated incomplete epic: ${validationErrors.join(', ')}. Please try again.`);
    }

    // Validate and normalize the response
    const result: EpicGenerationResult = {
      title: generated.title,
      description: generated.description,
      frontend_issues: generated.frontend_issues,
      backend_issues: generated.backend_issues,
      design_issues: generated.design_issues || [],
      definition_of_done: generated.definition_of_done,
      value_tags: generated.value_tags || [],
      risk_level: generated.risk_level || 'medium',
      effort_estimate: generated.effort_estimate || 'To be determined',
    };

    logger.info('[Epic Generator] Generation successful and validated:', {
      specId: spec.id,
      title: result.title,
      descriptionLength: result.description.length,
      frontendIssues: result.frontend_issues.length,
      backendIssues: result.backend_issues.length,
      designIssues: result.design_issues?.length || 0,
      dodCount: result.definition_of_done.length,
    });

    return result;
  } catch (error) {
    logger.error('[Epic Generator] Generation failed:', error);
    
    // Don't return weak fallback - throw the error so UI can handle it properly
    throw new Error(
      `Epic generation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or check your AI configuration.`
    );
  }
}
