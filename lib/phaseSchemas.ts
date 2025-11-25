import { z } from 'zod';
import type {
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data,
  Phase6Data,
} from '@/types/phases';

// Phase 1 Schema
export const phase1Schema = z.object({
  problem_statement: z.string().default(''),
  target_users: z.array(z.string()).default([]),
  why_now: z.string().default(''),
  value_hypothesis: z.string().default(''),
  constraints: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  initial_features: z.array(z.string()).default([]),
  feasibility_notes: z.string().default(''),
  high_level_timeline: z.string().default(''),
});

// Phase 2 Schema
export const phase2Schema = z.object({
  personas: z.array(z.object({
    name: z.string(),
    description: z.string(),
    goals: z.array(z.string()),
    pains: z.array(z.string()),
  })).default([]),
  jtbd: z.array(z.object({
    statement: z.string(),
    persona: z.string(),
    outcome: z.string(),
  })).default([]),
  business_outcomes: z.array(z.string()).default([]),
  kpis: z.array(z.string()).default([]),
  features: z.array(z.object({
    title: z.string(),
    description: z.string(),
    target_persona: z.string(),
    target_outcome: z.string(),
  })).default([]),
  scored_features: z.array(z.object({
    title: z.string(),
    description: z.string(),
    target_persona: z.string(),
    target_outcome: z.string(),
    impact: z.number(),
    effort: z.number(),
    confidence: z.number(),
    mvp_group: z.enum(['mvp', 'v2', 'v3']),
  })).default([]),
  tech_stack_preferences: z.string().default(''),
});

// Phase 3 Schema
export const phase3Schema = z.object({
  screens: z.array(z.object({
    screen_key: z.string(),
    title: z.string(),
    description: z.string(),
    roles: z.array(z.string()),
    is_core: z.boolean(),
  })).default([]),
  flows: z.array(z.object({
    name: z.string(),
    start_screen: z.string(),
    end_screen: z.string(),
    steps: z.array(z.string()),
    notes: z.string(),
  })).default([]),
  components: z.array(z.object({
    name: z.string(),
    description: z.string(),
    props: z.record(z.string()),
    state_behavior: z.string(),
    used_on: z.array(z.string()),
  })).default([]),
  design_tokens: z.object({
    colors: z.record(z.string()),
    typography: z.record(z.string()),
    spacing: z.record(z.string()),
  }).default({ colors: {}, typography: {}, spacing: {} }),
  navigation: z.object({
    primary_nav: z.array(z.string()),
    secondary_nav: z.array(z.string()),
    route_map: z.record(z.string()),
  }).default({ primary_nav: [], secondary_nav: [], route_map: {} }),
});

// Phase 4 Schema
export const phase4Schema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    key_fields: z.array(z.string()),
    relationships: z.array(z.string()),
  })).default([]),
  erd: z.union([
    z.object({
      entities: z.array(z.object({
        name: z.string(),
        attributes: z.array(z.object({
          name: z.string(),
          type: z.string(),
          primary: z.boolean().optional(),
          foreign: z.boolean().optional(),
          nullable: z.boolean().optional(),
        })),
      })).default([]),
      relationships: z.array(z.object({
        from: z.string(),
        to: z.string(),
        type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
        label: z.string().optional(),
      })).default([]),
    }),
    z.record(z.unknown()), // Backward compatibility with old format
  ]).default({ entities: [], relationships: [] }),
  api_spec: z.array(z.object({
    endpoint: z.string(),
    method: z.string(),
    path: z.string(),
    description: z.string(),
    request_params: z.record(z.string()),
    body_schema: z.record(z.unknown()),
    response_schema: z.record(z.unknown()),
    error_codes: z.array(z.string()),
  })).default([]),
  user_stories: z.array(z.object({
    user_role: z.string(),
    statement: z.string(),
  })).default([]),
  acceptance_criteria: z.array(z.object({
    story_id: z.string(),
    given: z.string(),
    when: z.string(),
    then: z.string(),
  })).default([]),
  rbac: z.record(z.unknown()).default({}),
  non_functional_requirements: z.string().default(''),
});

// Phase 5 Schema
export const phase5Schema = z.object({
  folder_structure: z.string().default(''),
  architecture_instructions: z.string().default(''),
  coding_standards: z.string().default(''),
  env_setup: z.string().default(''),
});

// Phase 6 Schema
export const phase6Schema = z.object({
  test_plan: z.string().default(''),
  test_cases: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['unit', 'integration', 'e2e']),
    steps: z.array(z.string()),
    expected_result: z.string(),
  })).default([]),
  security_checklist: z.array(z.string()).default([]),
  performance_requirements: z.string().default(''),
  launch_readiness: z.array(z.string()).default([]),
});

// Default empty data for each phase
export function getDefaultPhaseData(phaseNumber: number): Phase1Data | Phase2Data | Phase3Data | Phase4Data | Phase5Data | Phase6Data {
  switch (phaseNumber) {
    case 1:
      return phase1Schema.parse({}) as Phase1Data;
    case 2:
      return phase2Schema.parse({}) as Phase2Data;
    case 3:
      return phase3Schema.parse({}) as Phase3Data;
    case 4:
      return phase4Schema.parse({}) as Phase4Data;
    case 5:
      return phase5Schema.parse({}) as Phase5Data;
    case 6:
      return phase6Schema.parse({}) as Phase6Data;
    default:
      throw new Error(`Invalid phase number: ${phaseNumber}`);
  }
}

