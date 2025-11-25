export interface Phase1Data {
  problem_statement: string;
  target_users: string[];
  why_now: string;
  value_hypothesis: string;
  constraints: string[];
  risks: string[];
  assumptions: string[];
  initial_features: string[];
  feasibility_notes: string;
  high_level_timeline: string;
  master_prompt?: string;
  generated_document?: string;
  document_generated_at?: string;
}

export interface Phase2Data {
  personas: Persona[];
  jtbd: JTBD[];
  business_outcomes: string[];
  kpis: string[];
  features: Feature[];
  scored_features: ScoredFeature[];
  tech_stack_preferences: string;
  master_prompt?: string;
  generated_document?: string;
  document_generated_at?: string;
}

export interface Persona {
  name: string;
  description: string;
  goals: string[];
  pains: string[];
}

export interface JTBD {
  statement: string;
  persona: string;
  outcome: string;
}

export interface Feature {
  title: string;
  description: string;
  target_persona: string;
  target_outcome: string;
}

export interface ScoredFeature extends Feature {
  impact: number;
  effort: number;
  confidence: number;
  mvp_group: 'mvp' | 'v2' | 'v3';
}

export interface Phase3Data {
  screens: Screen[];
  flows: Flow[];
  components: Component[];
  design_tokens: DesignTokens;
  navigation: Navigation;
  master_prompt?: string;
  generated_document?: string;
  document_generated_at?: string;
}

export interface Screen {
  screen_key: string;
  title: string;
  description: string;
  roles: string[];
  is_core: boolean;
}

export interface Flow {
  name: string;
  start_screen: string;
  end_screen: string;
  steps: string[];
  notes: string;
}

export interface Component {
  name: string;
  description: string;
  props: Record<string, string>;
  state_behavior: string;
  used_on: string[];
}

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
}

export interface Navigation {
  primary_nav: string[];
  secondary_nav: string[];
  route_map: Record<string, string>;
}

export interface Phase4Data {
  entities: Entity[];
  erd: ERDData;
  api_spec: APISpec[];
  user_stories: UserStory[];
  acceptance_criteria: AcceptanceCriteria[];
  rbac: Record<string, unknown>;
  non_functional_requirements: string;
  master_prompt?: string;
  generated_document?: string;
  document_generated_at?: string;
}

export interface ERDData {
  entities: ERDEntity[];
  relationships: ERDRelationship[];
}

export interface ERDEntity {
  name: string;
  attributes: ERDAttribute[];
}

export interface ERDAttribute {
  name: string;
  type: string;
  primary?: boolean;
  foreign?: boolean;
  nullable?: boolean;
}

export interface ERDRelationship {
  from: string; // entity name
  to: string; // entity name
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  label?: string;
}

export interface Entity {
  name: string;
  description: string;
  key_fields: string[];
  relationships: string[];
}

export interface APISpec {
  endpoint: string;
  method: string;
  path: string;
  description: string;
  request_params: Record<string, string>;
  body_schema: Record<string, unknown>;
  response_schema: Record<string, unknown>;
  error_codes: string[];
}

export interface UserStory {
  user_role: string;
  statement: string;
}

export interface AcceptanceCriteria {
  story_id: string;
  given: string;
  when: string;
  then: string;
}

export interface Phase5Data {
  folder_structure: string;
  architecture_instructions: string;
  coding_standards: string;
  env_setup: string;
  build_timeline?: string;
  master_prompt?: string;
  generated_document?: string;
  document_generated_at?: string;
}

export interface Phase6Data {
  test_plan: string;
  test_cases: TestCase[];
  security_checklist: string[];
  performance_requirements: string;
  launch_readiness: string[];
  master_prompt?: string;
  generated_document?: string;
  document_generated_at?: string;
}

export interface TestCase {
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  steps: string[];
  expected_result: string;
}

// Union type for all phase data types
export type PhaseData = Phase1Data | Phase2Data | Phase3Data | Phase4Data | Phase5Data | Phase6Data | Record<string, any>;

// Phase metadata interface
export interface PhaseMetadata {
  phase_number: number;
  phase_name: string;
  display_order: number;
  is_active: boolean;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string;
  display_order: number;
  is_active: boolean;
  data: PhaseData;
  completed: boolean;
  updated_at: string;
}

