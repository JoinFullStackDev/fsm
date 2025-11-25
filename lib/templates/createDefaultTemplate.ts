import type { TemplateFieldConfig } from '@/types/templates';

// Field definitions for each phase based on current structure
export const PHASE_FIELD_DEFINITIONS: Record<number, Array<Omit<TemplateFieldConfig, 'id' | 'template_id' | 'created_at'>>> = {
  1: [
    {
      phase_number: 1,
      field_key: 'problem_statement',
      field_type: 'textarea',
      display_order: 1,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Problem Statement',
        helpText: 'Clearly define the problem your product solves. Be specific about pain points, who experiences them, and why existing solutions fall short.',
        placeholder: 'Describe the problem this product solves...',
        required: true,
        aiSettings: {
          enabled: true,
          customPrompt: 'Generate a clear, concise problem statement for a product.',
        },
      },
    },
    {
      phase_number: 1,
      field_key: 'target_users',
      field_type: 'array',
      display_order: 2,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Target Users',
        helpText: 'Identify the primary user segments who will benefit from your product.',
        required: true,
        aiSettings: {
          enabled: true,
          customPrompt: 'Based on this problem statement, suggest target user segments.',
        },
      },
    },
    {
      phase_number: 1,
      field_key: 'why_now',
      field_type: 'textarea',
      display_order: 3,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Why Now',
        helpText: 'Explain the market timing and why this is the right moment for this product.',
        placeholder: 'Why is now the right time for this product?',
      },
    },
    {
      phase_number: 1,
      field_key: 'value_hypothesis',
      field_type: 'textarea',
      display_order: 4,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Value Hypothesis',
        helpText: 'Describe the core value proposition and how it creates value for users.',
        placeholder: 'What value does this product create?',
      },
    },
    {
      phase_number: 1,
      field_key: 'constraints',
      field_type: 'array',
      display_order: 5,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Constraints',
        helpText: 'List any constraints (budget, time, tech, legal, etc.)',
      },
    },
    {
      phase_number: 1,
      field_key: 'risks',
      field_type: 'array',
      display_order: 6,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Risks',
        helpText: 'Identify potential risks and challenges.',
      },
    },
    {
      phase_number: 1,
      field_key: 'assumptions',
      field_type: 'array',
      display_order: 7,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Assumptions',
        helpText: 'List key assumptions that need to be validated.',
      },
    },
    {
      phase_number: 1,
      field_key: 'initial_features',
      field_type: 'array',
      display_order: 8,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Initial Features',
        helpText: 'High-level feature list (bullet points).',
      },
    },
    {
      phase_number: 1,
      field_key: 'feasibility_notes',
      field_type: 'textarea',
      display_order: 9,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Feasibility Notes',
        helpText: 'Very rough technical feasibility notes.',
        placeholder: 'Technical feasibility considerations...',
      },
    },
    {
      phase_number: 1,
      field_key: 'high_level_timeline',
      field_type: 'textarea',
      display_order: 10,
      layout_config: { columns: 12 },
      field_config: {
        label: 'High Level Timeline',
        helpText: 'Very rough timeline expectations.',
        placeholder: 'Timeline expectations...',
      },
    },
    {
      phase_number: 1,
      field_key: 'master_prompt',
      field_type: 'textarea',
      display_order: 11,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Master Prompt',
        helpText: 'Custom prompt for AI document generation. Use {{phase_data}} as placeholder.',
        placeholder: 'Enter custom prompt for document generation...',
      },
    },
  ],
  2: [
    {
      phase_number: 2,
      field_key: 'personas',
      field_type: 'custom',
      display_order: 1,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Personas',
        helpText: 'Define user personas with name, description, goals, and pains.',
        aiSettings: {
          enabled: true,
          customPrompt: 'Generate user personas based on target users and problem statement.',
        },
      },
    },
    {
      phase_number: 2,
      field_key: 'jtbd',
      field_type: 'custom',
      display_order: 2,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Jobs To Be Done',
        helpText: 'Define JTBD statements linking personas to outcomes.',
      },
    },
    {
      phase_number: 2,
      field_key: 'business_outcomes',
      field_type: 'array',
      display_order: 3,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Business Outcomes',
        helpText: 'List desired business outcomes.',
      },
    },
    {
      phase_number: 2,
      field_key: 'kpis',
      field_type: 'array',
      display_order: 4,
      layout_config: { columns: 12 },
      field_config: {
        label: 'KPIs',
        helpText: 'Key performance indicators to measure success.',
      },
    },
    {
      phase_number: 2,
      field_key: 'features',
      field_type: 'custom',
      display_order: 5,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Features',
        helpText: 'Feature ideas with title, description, target persona, and outcome.',
      },
    },
    {
      phase_number: 2,
      field_key: 'scored_features',
      field_type: 'custom',
      display_order: 6,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Scored Features',
        helpText: 'Features with impact/effort/confidence scoring and MVP grouping.',
      },
    },
    {
      phase_number: 2,
      field_key: 'tech_stack_preferences',
      field_type: 'textarea',
      display_order: 7,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Tech Stack Preferences',
        helpText: 'Preferred technologies and constraints (e.g., "React + Supabase", "must be HIPAA-friendly").',
        placeholder: 'Tech stack preferences and constraints...',
      },
    },
    {
      phase_number: 2,
      field_key: 'master_prompt',
      field_type: 'textarea',
      display_order: 8,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Master Prompt',
        helpText: 'Custom prompt for AI document generation. Use {{phase_data}} as placeholder.',
        placeholder: 'Enter custom prompt for document generation...',
      },
    },
  ],
  3: [
    {
      phase_number: 3,
      field_key: 'screens',
      field_type: 'custom',
      display_order: 1,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Screens',
        helpText: 'Define screens with key, title, description, roles, and core flag.',
      },
    },
    {
      phase_number: 3,
      field_key: 'flows',
      field_type: 'custom',
      display_order: 2,
      layout_config: { columns: 12 },
      field_config: {
        label: 'User Flows',
        helpText: 'Define user flows with name, start/end screens, steps, and notes.',
      },
    },
    {
      phase_number: 3,
      field_key: 'components',
      field_type: 'custom',
      display_order: 3,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Components',
        helpText: 'Define components with name, description, props, state behavior, and usage.',
      },
    },
    {
      phase_number: 3,
      field_key: 'design_tokens',
      field_type: 'custom',
      display_order: 4,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Design Tokens',
        helpText: 'Color tokens, typography scale, and spacing notes.',
      },
    },
    {
      phase_number: 3,
      field_key: 'navigation',
      field_type: 'custom',
      display_order: 5,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Navigation',
        helpText: 'Primary nav, secondary nav, and route map.',
      },
    },
    {
      phase_number: 3,
      field_key: 'master_prompt',
      field_type: 'textarea',
      display_order: 6,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Master Prompt',
        helpText: 'Custom prompt for AI document generation. Use {{phase_data}} as placeholder.',
        placeholder: 'Enter custom prompt for document generation...',
      },
    },
  ],
  4: [
    {
      phase_number: 4,
      field_key: 'entities',
      field_type: 'custom',
      display_order: 1,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Entities & Data Models',
        helpText: 'Define entities with name, description, key fields, and relationships.',
      },
    },
    {
      phase_number: 4,
      field_key: 'erd',
      field_type: 'custom',
      display_order: 2,
      layout_config: { columns: 12 },
      field_config: {
        label: 'ERD Structure',
        helpText: 'Entity-relationship diagram structure (text/JSON).',
      },
    },
    {
      phase_number: 4,
      field_key: 'api_spec',
      field_type: 'custom',
      display_order: 3,
      layout_config: { columns: 12 },
      field_config: {
        label: 'API Specifications',
        helpText: 'API endpoints with method, path, description, schemas, and error codes.',
      },
    },
    {
      phase_number: 4,
      field_key: 'user_stories',
      field_type: 'custom',
      display_order: 4,
      layout_config: { columns: 12 },
      field_config: {
        label: 'User Stories',
        helpText: 'User stories with role and "As a... I want... so that..." statements.',
      },
    },
    {
      phase_number: 4,
      field_key: 'acceptance_criteria',
      field_type: 'custom',
      display_order: 5,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Acceptance Criteria',
        helpText: 'Acceptance criteria per story in Given/When/Then format.',
      },
    },
    {
      phase_number: 4,
      field_key: 'rbac',
      field_type: 'custom',
      display_order: 6,
      layout_config: { columns: 12 },
      field_config: {
        label: 'RBAC Matrix',
        helpText: 'Roles x actions matrix (view/create/edit/delete per entity).',
      },
    },
    {
      phase_number: 4,
      field_key: 'non_functional_requirements',
      field_type: 'textarea',
      display_order: 7,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Non-Functional Requirements',
        helpText: 'Security, performance, compliance, logging, auditability requirements.',
        placeholder: 'Non-functional requirements...',
      },
    },
    {
      phase_number: 4,
      field_key: 'master_prompt',
      field_type: 'textarea',
      display_order: 8,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Master Prompt',
        helpText: 'Custom prompt for AI document generation. Use {{phase_data}} as placeholder.',
        placeholder: 'Enter custom prompt for document generation...',
      },
    },
  ],
  5: [
    {
      phase_number: 5,
      field_key: 'folder_structure',
      field_type: 'textarea',
      display_order: 1,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Folder Structure',
        helpText: 'Preferred folder structure definition (frontend/backend/shared).',
        placeholder: 'Define folder structure...',
      },
    },
    {
      phase_number: 5,
      field_key: 'architecture_instructions',
      field_type: 'textarea',
      display_order: 2,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Architecture Instructions',
        helpText: 'Preferred architecture pattern (e.g., Next.js App Router, file-based routing).',
        placeholder: 'Architecture instructions...',
      },
    },
    {
      phase_number: 5,
      field_key: 'coding_standards',
      field_type: 'textarea',
      display_order: 3,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Coding Standards & Patterns',
        helpText: 'TypeScript, hooks, separation of concerns guidelines.',
        placeholder: 'Coding standards...',
      },
    },
    {
      phase_number: 5,
      field_key: 'env_setup',
      field_type: 'textarea',
      display_order: 4,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Environment & Config Notes',
        helpText: 'Env vars required, basic secrets (described, not actual secrets).',
        placeholder: 'Environment setup notes...',
      },
    },
    {
      phase_number: 5,
      field_key: 'master_prompt',
      field_type: 'textarea',
      display_order: 5,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Master Prompt',
        helpText: 'Custom prompt for AI document generation. Use {{phase_data}} as placeholder.',
        placeholder: 'Enter custom prompt for document generation...',
      },
    },
  ],
  6: [
    {
      phase_number: 6,
      field_key: 'test_plan',
      field_type: 'textarea',
      display_order: 1,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Test Strategy',
        helpText: 'Test strategy (unit, integration, e2e).',
        placeholder: 'Test strategy...',
      },
    },
    {
      phase_number: 6,
      field_key: 'test_cases',
      field_type: 'custom',
      display_order: 2,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Test Cases',
        helpText: 'Core test cases (at least for key flows).',
      },
    },
    {
      phase_number: 6,
      field_key: 'security_checklist',
      field_type: 'array',
      display_order: 3,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Security & Hardening Checklist',
        helpText: 'Security and hardening checklist items.',
      },
    },
    {
      phase_number: 6,
      field_key: 'performance_requirements',
      field_type: 'textarea',
      display_order: 4,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Performance Expectations',
        helpText: 'Performance expectations (e.g., response times).',
        placeholder: 'Performance requirements...',
      },
    },
    {
      phase_number: 6,
      field_key: 'launch_readiness',
      field_type: 'array',
      display_order: 5,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Launch Readiness Checklist',
        helpText: 'Launch readiness checklist items.',
      },
    },
    {
      phase_number: 6,
      field_key: 'master_prompt',
      field_type: 'textarea',
      display_order: 6,
      layout_config: { columns: 12 },
      field_config: {
        label: 'Master Prompt',
        helpText: 'Custom prompt for AI document generation. Use {{phase_data}} as placeholder.',
        placeholder: 'Enter custom prompt for document generation...',
      },
    },
  ],
};

export function getDefaultFieldConfigsForPhase(phaseNumber: number, templateId: string): TemplateFieldConfig[] {
  const definitions = PHASE_FIELD_DEFINITIONS[phaseNumber] || [];
  return definitions.map(def => ({
    ...def,
    template_id: templateId,
  }));
}

