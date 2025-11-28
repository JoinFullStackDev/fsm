import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasAIFeatures } from '@/lib/packageLimits';
import { generateStructuredAIResponse } from '@/lib/ai/geminiClient';

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return NextResponse.json({ error: 'User is not assigned to an organization' }, { status: 400 });
    }

    // Check if organization has AI features enabled
    const hasAI = await hasAIFeatures(supabase, organizationId);
    if (!hasAI) {
      return NextResponse.json({ error: 'AI features are not available in your package' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, is_public, is_publicly_available } = body;

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

    // Create comprehensive prompt for AI
    const prompt = `You are an expert at creating project management templates. Based on the user's requirements, generate a complete template structure with phases and fields.

IMPORTANT: You must respond with ONLY valid JSON. Do not include any markdown code blocks, explanations, or additional text. Start your response directly with the opening brace { and end with the closing brace }.

User Requirements:
Template Name: ${name}
Description: ${description}
${category ? `Category: ${category}` : ''}

Your task is to generate a JSON structure with:
1. Template metadata (name, description, category)
2. Phases array - each phase should have:
   - phase_number: sequential number starting from 1
   - phase_name: descriptive name (e.g., "Discovery", "Design", "Development", "Launch")
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
- Create 3-6 phases that logically progress through the project lifecycle
- Each phase should have 3-8 relevant fields
- Phase names should be clear and action-oriented
- Field labels should be concise but descriptive
- Include helpText to guide users on what to enter
- Mark critical fields as required
- Enable AI settings for fields that would benefit from AI assistance
- Use appropriate field types based on the data being collected

Generate a comprehensive template that covers the full project lifecycle based on the user's description. Be creative but practical.

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

    // Generate structured response
    let result: GeneratedTemplate;
    try {
      result = await generateStructuredAIResponse<GeneratedTemplate>(
        prompt,
        {
          context: 'Generate project template structure',
        },
        apiKey
      );
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

