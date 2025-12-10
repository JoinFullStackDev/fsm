/**
 * Product Workspace Type Definitions
 * Provides TypeScript types for the Product Workspace module
 */

// ============================================
// PROJECT WORKSPACE
// ============================================

export interface ProjectWorkspace {
  id: string;
  project_id: string;
  organization_id: string;
  active_clarity_spec_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

// ============================================
// CLARITY SPEC
// ============================================

export type ClaritySpecStatus = 'draft' | 'in_review' | 'ready' | 'archived';

export interface ClaritySpec {
  id: string;
  workspace_id: string;
  version: number;
  
  // Problem Framing
  problem_statement: string | null;
  jobs_to_be_done: string[];
  user_pains: string[];
  
  // Business Intent
  business_goals: string[];
  success_metrics: string[];
  constraints: string[];
  assumptions: string[];
  
  // Outcomes
  desired_outcomes: string[];
  
  // Mental Models
  mental_model_notes: string | null;
  stakeholder_notes: string | null;
  
  // AI Analysis
  ai_readiness_score: number | null;
  ai_risk_warnings: string[];
  ai_suggestions: string[];
  ai_last_analyzed_at: string | null;
  
  // Status
  status: ClaritySpecStatus;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
  snapshot_data: Record<string, unknown> | null;
}

// ============================================
// EPIC DRAFT
// ============================================

export type EpicDraftStatus = 'draft' | 'ready' | 'exported' | 'archived';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface IssueDefinition {
  title: string;
  description: string;
  acceptance_criteria: string[];
  estimated_hours?: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface EpicDraft {
  id: string;
  workspace_id: string;
  clarity_spec_id: string | null;
  
  // Epic Content
  title: string;
  description: string | null;
  
  // Decomposed Issues
  frontend_issues: IssueDefinition[];
  backend_issues: IssueDefinition[];
  design_issues: IssueDefinition[];
  
  // Metadata
  definition_of_done: string[];
  value_tags: string[];
  risk_level: RiskLevel;
  effort_estimate: string | null;
  
  // Export Tracking
  exported_to_gitlab: boolean;
  gitlab_epic_id: string | null;
  gitlab_exported_at: string | null;
  
  // Task Generation
  tasks_generated: boolean;
  tasks_generated_at: string | null;
  generated_task_ids: string[];
  
  // Status
  status: EpicDraftStatus;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// WORKSPACE DECISION
// ============================================

export interface DecisionOption {
  option: string;
  pros: string[];
  cons: string[];
}

export interface WorkspaceDecision {
  id: string;
  workspace_id: string;
  
  // Decision Content
  title: string;
  context: string | null;
  decision: string;
  rationale: string | null;
  
  // Options
  options_considered: DecisionOption[];
  chosen_option: string | null;
  
  // Constraints
  constraints: string[];
  tradeoffs: string | null;
  
  // Links
  linked_clarity_spec_id: string | null;
  linked_epic_draft_id: string | null;
  
  // Metadata
  decision_date: string;
  decided_by: string[];
  tags: string[];
  
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// WORKSPACE DEBT
// ============================================

export type DebtType = 'technical' | 'product' | 'design' | 'operational';
export type DebtSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DebtStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';

export interface WorkspaceDebt {
  id: string;
  workspace_id: string;
  
  // Content
  title: string;
  description: string;
  debt_type: DebtType;
  
  // Impact
  severity: DebtSeverity;
  impact_areas: string[];
  estimated_effort: string | null;
  
  // Age
  identified_date: string;
  
  // Resolution
  status: DebtStatus;
  resolved_date: string | null;
  resolution_notes: string | null;
  
  // Links
  related_task_ids: string[];
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// EXTENDED TYPES WITH RELATIONS
// ============================================

export interface ProjectWorkspaceWithCounts extends ProjectWorkspace {
  clarity_spec_count: number;
  epic_draft_count: number;
  decision_count: number;
  debt_count: number;
}

export interface ClaritySpecWithWorkspace extends ClaritySpec {
  workspace?: ProjectWorkspace;
}

export interface EpicDraftWithRelations extends EpicDraft {
  clarity_spec?: ClaritySpec;
  workspace?: ProjectWorkspace;
}

// ============================================
// INPUT TYPES (for API requests)
// ============================================

export interface CreateClaritySpecInput {
  workspace_id: string;
  problem_statement?: string;
  jobs_to_be_done?: string[];
  user_pains?: string[];
  business_goals?: string[];
  success_metrics?: string[];
  constraints?: string[];
  assumptions?: string[];
  desired_outcomes?: string[];
  mental_model_notes?: string;
  stakeholder_notes?: string;
}

export interface UpdateClaritySpecInput {
  problem_statement?: string;
  jobs_to_be_done?: string[];
  user_pains?: string[];
  business_goals?: string[];
  success_metrics?: string[];
  constraints?: string[];
  assumptions?: string[];
  desired_outcomes?: string[];
  mental_model_notes?: string;
  stakeholder_notes?: string;
  status?: ClaritySpecStatus;
}

export interface CreateEpicDraftInput {
  workspace_id: string;
  clarity_spec_id?: string;
  title: string;
  description?: string;
  frontend_issues?: IssueDefinition[];
  backend_issues?: IssueDefinition[];
  design_issues?: IssueDefinition[];
  definition_of_done?: string[];
  value_tags?: string[];
  risk_level?: RiskLevel;
  effort_estimate?: string;
}

export interface UpdateEpicDraftInput {
  title?: string;
  description?: string;
  frontend_issues?: IssueDefinition[];
  backend_issues?: IssueDefinition[];
  design_issues?: IssueDefinition[];
  definition_of_done?: string[];
  value_tags?: string[];
  risk_level?: RiskLevel;
  effort_estimate?: string;
  status?: EpicDraftStatus;
}

export interface CreateDecisionInput {
  workspace_id: string;
  title: string;
  context?: string;
  decision: string;
  rationale?: string;
  options_considered?: DecisionOption[];
  chosen_option?: string;
  constraints?: string[];
  tradeoffs?: string;
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  decision_date?: string;
  decided_by?: string[];
  tags?: string[];
}

export interface UpdateDecisionInput {
  title?: string;
  context?: string;
  decision?: string;
  rationale?: string;
  options_considered?: DecisionOption[];
  chosen_option?: string;
  constraints?: string[];
  tradeoffs?: string;
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  decision_date?: string;
  decided_by?: string[];
  tags?: string[];
}

export interface CreateDebtInput {
  workspace_id: string;
  title: string;
  description: string;
  debt_type: DebtType;
  severity?: DebtSeverity;
  impact_areas?: string[];
  estimated_effort?: string;
  identified_date?: string;
  related_task_ids?: string[];
}

export interface UpdateDebtInput {
  title?: string;
  description?: string;
  debt_type?: DebtType;
  severity?: DebtSeverity;
  impact_areas?: string[];
  estimated_effort?: string;
  status?: DebtStatus;
  resolved_date?: string;
  resolution_notes?: string;
  related_task_ids?: string[];
}

// ============================================
// AI ANALYSIS TYPES
// ============================================

export interface ClarityAnalysisResult {
  readiness_score: number;
  risk_warnings: string[];
  suggestions: string[];
  completeness: {
    problem_framing: number;
    business_intent: number;
    outcomes: number;
  };
}

export interface EpicGenerationResult {
  title: string;
  description: string;
  frontend_issues: IssueDefinition[];
  backend_issues: IssueDefinition[];
  design_issues?: IssueDefinition[];
  definition_of_done: string[];
  value_tags: string[];
  risk_level: RiskLevel;
  effort_estimate: string;
}

// ============================================
// DEBT AGGREGATION TYPES
// ============================================

export interface DebtHeatmapData {
  by_type: {
    technical: number;
    product: number;
    design: number;
    operational: number;
  };
  by_severity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  by_status: {
    open: number;
    in_progress: number;
    resolved: number;
    wont_fix: number;
  };
  average_age_days: number;
  oldest_item_age_days: number;
  total_count: number;
}

export interface DebtByArea {
  area: string;
  count: number;
  severity_breakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

// ============================================
// WORKSPACE CONVERSATIONS (AI CHAT)
// ============================================

export type ConversationActionType = 'create_task' | 'log_decision' | 'log_debt' | 'update_spec';
export type ConversationActionStatus = 'suggested' | 'confirmed' | 'executed' | 'rejected';

export interface ConversationAction {
  type: ConversationActionType;
  status: ConversationActionStatus;
  data: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: ConversationAction[];
}

export interface WorkspaceConversation {
  id: string;
  workspace_id: string;
  title: string;
  messages: ConversationMessage[];
  message_count: number;
  last_message_at: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceConversationSummary {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string | null;
  last_message_preview?: string;
}
