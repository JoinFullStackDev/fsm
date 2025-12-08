import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures } from '@/lib/packageLimits';
import { generateStructuredAIResponse, type AIResponseWithMetadata } from '@/lib/ai/geminiClient';
import { logAIUsage } from '@/lib/ai/aiUsageLogger';

interface GeneratedTemplate {
  template: {
    name: string;
    description: string;
    category?: string;
  };
  phases: Array<{
    phase_number: number;
    phase_name: string;
    display_order: number;
  }>;
  field_configs: Array<{
    phase_number: number;
    field_key: string;
    field_type: 'text' | 'textarea' | 'array' | 'object' | 'select' | 'checkbox' | 'slider' | 'date' | 'file' | 'table' | 'custom';
    display_order: number;
    layout_config: {
      columns: number;
      spacing?: number;
    };
    field_config: {
      label: string;
      helpText?: string;
      placeholder?: string;
      required?: boolean;
      aiSettings?: {
        enabled: boolean;
      };
    };
  }>;
}

function getMethodologyPrompt(
  methodology: string,
  name: string,
  description: string,
  category?: string | null
): string {
  const basePrompt = `You are an expert at creating project management templates. Based on the user's requirements, generate a complete template structure with phases and fields.

IMPORTANT: You must respond with ONLY valid JSON. Do not include any markdown code blocks, explanations, or additional text. Start your response directly with the opening brace { and end with the closing brace }.

User Requirements:
Template Name: ${name}
Description: ${description}
${category ? `Category: ${category}` : ''}

Your task is to generate a JSON structure with:
1. Template metadata (name, description, category)
2. Phases array - each phase should have:
   - phase_number: sequential number starting from 1
   - phase_name: descriptive name
   - display_order: same as phase_number
3. Field configurations array - each field should have:
   - phase_number: which phase this field belongs to
   - field_key: unique kebab-case identifier (e.g., "problem_statement", "target_users")
   - field_type: one of: text, textarea, array, select, checkbox, table, custom
   - display_order: order within the phase (starting from 1)
   - layout_config: { columns: 12 (full width) or 6 (half width), spacing: 2 }
   - field_config: {
       label: human-readable label
       helpText: helpful description (optional but recommended)
       placeholder: example text (optional)
       required: boolean
       aiSettings: { enabled: true } for fields that could benefit from AI assistance
     }

Field Type Guidelines:
- Use "text" for short single-line inputs (names, titles, short answers)
- Use "textarea" for longer multi-line text (descriptions, notes, explanations)
- Use "array" for lists of items (target users, features, requirements)
- Use "select" for dropdown choices (status, priority, category)
- Use "checkbox" for yes/no or boolean values
- Use "table" for structured data with rows and columns
- Use "custom" for complex structured data (API specs, ERD diagrams)

Best Practices:
- Create 4-12 phases based on project complexity and requirements (NOT a fixed number)
- Each phase should have 3-8 relevant fields
- Phase names should be clear and action-oriented
- Field labels should be concise but descriptive
- Include helpText to guide users on what to enter
- Mark critical fields as required
- Enable AI settings for fields that would benefit from AI assistance
- Use appropriate field types based on the data being collected

IMPORTANT: The number of phases should match the actual complexity and requirements described. Simple projects may need 4-5 phases, complex enterprise projects may need 10-12 phases. Analyze the description to determine the appropriate number.

`;

  const methodologyGuidance: Record<string, string> = {
    fsm: `Generate a FullStack Method™ template focused on comprehensive, guided product development.

The FullStack Method™ typically follows this flow (adapt phases based on project complexity - 4-12 phases):
- Concept Framing: Define the core problem, vision, goals, and high-level scope
- Solution Design: Outline user experience, key features, and technical approach
- Architecture: Detail system architecture, tech stack, data models (for technical projects)
- Development: Implementation phases (can be split into multiple phases for large projects)
- Testing: QA, integration testing, UAT (can be combined or separated based on scope)
- Launch: Release, deployment, and post-launch activities

Adjust the number and granularity of phases based on the project description. Simple projects may combine phases, complex projects should have more detailed phases.

Include relevant fields for: problem statements, user personas, user flows, technical specs, test plans, deployment checklists, etc. based on project needs.

The FullStack Method™ emphasizes guided, structured, comprehensive product development with AI assistance throughout.`,

    waterfall: `Generate a Waterfall template with sequential phases and clear phase gates.

Waterfall typically follows this flow (adapt phases based on project complexity - 4-10 phases):
- Requirements: Gather and document requirements upfront with stakeholder sign-offs
- Design: System design, architecture, technical specifications
- Implementation: Development according to specifications (can be split for large projects)
- Testing: QA, integration testing, UAT (can be split into multiple test phases)
- Deployment: Release planning, go-live, rollback procedures
- Maintenance: Ongoing support and updates (optional phase)

For larger projects, consider splitting phases like:
- High-Level Design → Detailed Design
- Unit Testing → Integration Testing → System Testing → UAT
- Development Phase 1 → Development Phase 2

Include fields for: requirements documents, sign-offs, design specs, test plans, deployment checklists, change requests, etc.

Waterfall methodology emphasizes sequential phases with clear gates - each phase should complete before the next. Documentation is critical.`,

    agile_scrum: `Generate an Agile/Scrum template with iterative sprint phases.

CRITICAL: If the user mentions a specific number of sprints (e.g., "4 sprints", "6-week project with 2-week sprints"), create a DEDICATED PHASE for EACH sprint mentioned or calculated.

Required phase structure:
1. Product Backlog - Epics, user stories, prioritization, backlog grooming
2. Sprint 1 - Sprint planning, execution, daily standups, sprint goal
3. Sprint 2 - Sprint planning, execution, daily standups, sprint goal
4. Sprint 3 - (continue for each sprint mentioned/needed)
... (one phase per sprint)
N-1. Sprint Review - Demo all completed work, stakeholder feedback
N. Retrospective - What went well, what didn't, action items for improvement

Example sprint count calculation:
- "8-week project with 2-week sprints" = 4 sprint phases
- "3 sprints" = 3 sprint phases
- "6 iterations" = 6 sprint phases
- If no sprint count mentioned, default to 4 sprints

Each Sprint phase should include fields for:
- Sprint Goal
- Selected User Stories (from backlog)
- Story Points Committed
- Daily Standup Notes
- Blockers/Impediments
- Sprint Burndown
- Completed Stories
- Carry-over Items

Include fields for: user stories, acceptance criteria, story points, velocity tracking, definition of done, blockers, demo notes, retro action items.

Agile/Scrum emphasizes iterative development, time-boxed sprints, continuous feedback, and adaptive planning.`,

    lean: `Generate a Lean Startup template focused on validated learning and MVP development.

Lean Startup follows Build-Measure-Learn cycles (adapt phases based on iteration depth - 4-10 phases):
- Problem Discovery: Validate problem exists and is worth solving
- Customer Research: User interviews, evidence gathering
- Solution Hypotheses: Formulate and prioritize assumptions to test
- MVP Definition: Define minimum viable product scope
- MVP Build: Build with essential features only
- Measure: Collect data on user behavior and key metrics
- Learn & Iterate: Analyze results, validate/invalidate hypotheses
- Pivot or Persevere: Decision phase based on learnings
- Scale (if validated): Growth and optimization

For projects with multiple pivot cycles, add additional Build-Measure-Learn phases.

Include fields for: problem interviews, hypothesis tracking, assumption logs, MVP features, metrics, A/B tests, pivot decisions, learnings.

Lean Startup emphasizes validated learning, rapid iteration, and data-driven decisions.`,

    design_thinking: `Generate a Design Thinking template focused on human-centered innovation.

Design Thinking follows an iterative human-centered approach (adapt phases based on project depth - 4-10 phases):
- Empathize: User research, interviews, observation, immersion
- Define: Synthesize findings, problem statements, user personas
- Ideate: Brainstorm solutions, divergent thinking, concept selection
- Prototype: Low-fidelity → High-fidelity prototyping (can be split into phases)
- Test: User testing, feedback collection, iteration
- Implement: Development based on validated designs (optional phases)

For complex design projects, consider:
- Splitting Empathize into Research + Synthesis phases
- Multiple Prototype phases (Sketches → Wireframes → Hi-Fi → Interactive)
- Multiple Test phases for different fidelity levels
- Adding Implementation phases if project includes development

Include fields for: research notes, empathy maps, personas, problem statements, ideation outputs, prototypes, testing feedback, iteration logs.

Design Thinking emphasizes empathy, rapid prototyping, and iterative testing with real users.`,

    custom: `Generate a custom template based on the user's specific requirements and description.

Analyze the user's description carefully and create phases and fields that match their specific needs. Consider:
- What methodology or approach does the description suggest?
- How complex is the project? (Simple: 4-6 phases, Medium: 6-8 phases, Complex: 8-12 phases)
- What are the key deliverables and milestones mentioned?
- What fields would be most useful for tracking this type of project?

Be flexible and creative while maintaining best practices. Create phases that logically flow from project initiation to completion based on the user's description.`,
  };

  const methodologySpecificGuidance = methodologyGuidance[methodology] || methodologyGuidance.custom;

  return `${basePrompt}${methodologySpecificGuidance}

Respond ONLY with valid JSON matching this exact structure:
{
  "template": {
    "name": "${name}",
    "description": "...",
    "category": "${category || ''}"
  },
  "phases": [
    {
      "phase_number": 1,
      "phase_name": "...",
      "display_order": 1
    }
  ],
  "field_configs": [
    {
      "phase_number": 1,
      "field_key": "...",
      "field_type": "...",
      "display_order": 1,
      "layout_config": { "columns": 12 },
      "field_config": {
        "label": "...",
        "helpText": "...",
        "required": false,
        "aiSettings": { "enabled": true }
      }
    }
  ]
}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User record not found' }, { status: 401 });
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return NextResponse.json({ error: 'User is not assigned to an organization' }, { status: 400 });
    }

    // Check if organization has AI features enabled
    const hasAI = await hasAIFeatures(supabase, organizationId);
    if (!hasAI) {
      return NextResponse.json({ error: 'AI features are not available in your package' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, methodology, is_public, is_publicly_available } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Template name and description are required' },
        { status: 400 }
      );
    }

    // Get Gemini API key (prioritizes environment variable - super admin's credentials)
    const { getGeminiApiKey } = await import('@/lib/utils/geminiConfig');
    const apiKey = await getGeminiApiKey(supabase);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please configure GOOGLE_GENAI_API_KEY environment variable or Admin Settings.' },
        { status: 400 }
      );
    }

    // Create methodology-specific prompt for AI
    const selectedMethodology = methodology || 'fsm'; // Default to FSM if not provided
    const prompt = getMethodologyPrompt(selectedMethodology, name, description, category);

    // Generate structured response with metadata tracking
    let result: GeneratedTemplate;
    let metadata: AIResponseWithMetadata['metadata'] | null = null;
    try {
      const response = await generateStructuredAIResponse<GeneratedTemplate>(
        prompt,
        {
          context: 'Generate project template structure',
        },
        apiKey,
        undefined,
        true, // returnMetadata
        'gemini-2.5-flash' // Use Flash for complex template structure generation
      );
      
      // Handle response with metadata
      if ('result' in response && 'metadata' in response) {
        result = response.result;
        metadata = response.metadata;
      } else {
        result = typeof response === 'object' && 'result' in response 
          ? (response as any).result 
          : response as GeneratedTemplate;
      }
    } catch (parseError) {
      // If parsing fails, try to get the raw response for debugging
      return NextResponse.json(
        {
          error: parseError instanceof Error 
            ? parseError.message 
            : 'Failed to parse AI response as JSON. The AI may have returned invalid JSON or included extra text.',
        },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!result.template || !result.phases || !result.field_configs) {
      return NextResponse.json(
        { error: 'Invalid AI response structure' },
        { status: 500 }
      );
    }

    // Ensure phase numbers are sequential and start from 1
    const sortedPhases = result.phases
      .sort((a, b) => a.display_order - b.display_order)
      .map((phase, index) => ({
        ...phase,
        phase_number: index + 1,
        display_order: index + 1,
      }));

    // Update field_configs to match corrected phase numbers
    const updatedFieldConfigs = result.field_configs.map((field) => {
      const phaseIndex = result.phases.findIndex(
        (p) => p.phase_number === field.phase_number || p.display_order === field.phase_number
      );
      const newPhaseNumber = phaseIndex >= 0 ? phaseIndex + 1 : field.phase_number;
      
      return {
        ...field,
        phase_number: newPhaseNumber,
      };
    });

    // Ensure field_keys are unique and kebab-case
    const seenKeys = new Set<string>();
    const validatedFieldConfigs = updatedFieldConfigs.map((field) => {
      let fieldKey = field.field_key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      // Ensure uniqueness
      let uniqueKey = fieldKey;
      let counter = 1;
      while (seenKeys.has(uniqueKey)) {
        uniqueKey = `${fieldKey}_${counter}`;
        counter++;
      }
      seenKeys.add(uniqueKey);

      return {
        ...field,
        field_key: uniqueKey,
      };
    });

    // Log AI usage (non-blocking)
    if (metadata && userData?.id) {
      const { logAIUsage } = await import('@/lib/ai/aiUsageLogger');
      logAIUsage(
        supabase,
        userData.id,
        'template_generation',
        metadata,
        null,
        null
      ).catch((err) => {
        // Use console.error since logger might not be imported
        console.error('[Template Generate] Error logging AI usage:', err);
      });
    }

    return NextResponse.json({
      result: {
        template: {
          ...result.template,
          name,
          category: category || result.template.category || null,
        },
        phases: sortedPhases,
        field_configs: validatedFieldConfigs,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate template',
      },
      { status: 500 }
    );
  }
}

