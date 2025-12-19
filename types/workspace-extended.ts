/**
 * Extended Product Workspace Type Definitions
 * Phase 1: Success Metrics Dashboard + Discovery Hub
 * Phase 2: Strategy Canvas + Roadmap Planner
 * Phase 3: Stakeholder Hub
 */

// ============================================
// PHASE 1: SUCCESS METRICS DASHBOARD
// ============================================

export type MetricType = 'kpi' | 'product_health' | 'business_impact' | 'technical';
export type MetricStatus = 'active' | 'archived';
export type HealthStatus = 'on_track' | 'at_risk' | 'off_track';

export interface DataPoint {
  date: string;
  value: number;
}

export interface SuccessMetric {
  id: string;
  workspace_id: string;
  
  // Metric Definition
  metric_name: string;
  metric_type: MetricType;
  description: string | null;
  
  // Targets & Values
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  
  // Tracking
  measurement_frequency: string | null;
  data_source: string | null;
  data_points: DataPoint[];
  
  // Relationships
  linked_clarity_spec_id: string | null;
  linked_epic_draft_id: string | null;
  
  // Status
  status: MetricStatus;
  health_status: HealthStatus | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSuccessMetricInput {
  workspace_id: string;
  metric_name: string;
  metric_type: MetricType;
  description?: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  measurement_frequency?: string;
  data_source?: string;
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  health_status?: HealthStatus;
}

export interface UpdateSuccessMetricInput {
  metric_name?: string;
  metric_type?: MetricType;
  description?: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  measurement_frequency?: string;
  data_source?: string;
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  status?: MetricStatus;
  health_status?: HealthStatus;
}

export interface MetricsDashboardData {
  total_metrics: number;
  metrics_on_track: number;
  metrics_at_risk: number;
  metrics_off_track: number;
  metrics_by_type: {
    kpi: number;
    product_health: number;
    business_impact: number;
    technical: number;
  };
  recent_metrics: SuccessMetric[];
}

// ============================================
// PHASE 1: DISCOVERY HUB - USER INSIGHTS
// ============================================

export type InsightType = 'interview' | 'feedback' | 'survey' | 'support_ticket' | 'usability_test';

export interface Quote {
  quote: string;
  speaker: string;
  context: string;
}

export interface UserInsight {
  id: string;
  workspace_id: string;
  
  // Insight Type
  insight_type: InsightType;
  
  // Content
  title: string;
  summary: string | null;
  full_content: string | null;
  source: string | null;
  
  // Extracted Insights
  pain_points: string[];
  feature_requests: string[];
  quotes: Quote[];
  tags: string[];
  
  // User Context
  user_segment: string | null;
  user_role: string | null;
  
  // Validation
  validated_assumptions: string[];
  invalidated_assumptions: string[];
  
  // Relationships
  linked_clarity_spec_id: string | null;
  
  // Metadata
  insight_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInsightInput {
  workspace_id: string;
  insight_type: InsightType;
  title: string;
  summary?: string;
  full_content?: string;
  source?: string;
  pain_points?: string[];
  feature_requests?: string[];
  quotes?: Quote[];
  tags?: string[];
  user_segment?: string;
  user_role?: string;
  validated_assumptions?: string[];
  invalidated_assumptions?: string[];
  linked_clarity_spec_id?: string;
  insight_date?: string;
}

export interface UpdateUserInsightInput {
  insight_type?: InsightType;
  title?: string;
  summary?: string;
  full_content?: string;
  source?: string;
  pain_points?: string[];
  feature_requests?: string[];
  quotes?: Quote[];
  tags?: string[];
  user_segment?: string;
  user_role?: string;
  validated_assumptions?: string[];
  invalidated_assumptions?: string[];
  linked_clarity_spec_id?: string;
  insight_date?: string;
}

// ============================================
// PHASE 1: DISCOVERY HUB - EXPERIMENTS
// ============================================

export type ExperimentType = 'ab_test' | 'prototype' | 'landing_page' | 'concierge' | 'wizard_of_oz' | 'interview';
export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'cancelled';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface Experiment {
  id: string;
  workspace_id: string;
  
  // Experiment Definition
  title: string;
  hypothesis: string;
  experiment_type: ExperimentType;
  
  // Setup
  description: string | null;
  success_criteria: string[];
  target_sample_size: number | null;
  
  // Results
  status: ExperimentStatus;
  actual_sample_size: number | null;
  results_summary: string | null;
  key_learnings: string[];
  
  // Decision
  hypothesis_validated: boolean | null;
  confidence_level: ConfidenceLevel | null;
  next_actions: string[];
  
  // Timeline
  start_date: string | null;
  end_date: string | null;
  
  // Relationships
  linked_clarity_spec_id: string | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExperimentInput {
  workspace_id: string;
  title: string;
  hypothesis: string;
  experiment_type: ExperimentType;
  description?: string;
  success_criteria?: string[];
  target_sample_size?: number;
  linked_clarity_spec_id?: string;
  start_date?: string;
}

export interface UpdateExperimentInput {
  title?: string;
  hypothesis?: string;
  experiment_type?: ExperimentType;
  description?: string;
  success_criteria?: string[];
  target_sample_size?: number;
  status?: ExperimentStatus;
  actual_sample_size?: number;
  results_summary?: string;
  key_learnings?: string[];
  hypothesis_validated?: boolean;
  confidence_level?: ConfidenceLevel;
  next_actions?: string[];
  start_date?: string;
  end_date?: string;
  linked_clarity_spec_id?: string;
}

// ============================================
// PHASE 1: DISCOVERY HUB - FEEDBACK
// ============================================

export type FeedbackType = 'feature_request' | 'bug_report' | 'complaint' | 'praise' | 'question';
export type FeedbackStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'wont_do' | 'duplicate';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Feedback {
  id: string;
  workspace_id: string;
  
  // Feedback Content
  title: string;
  content: string;
  feedback_type: FeedbackType;
  
  // Classification
  priority: FeedbackPriority;
  category: string[];
  affected_feature: string | null;
  
  // Source
  source: string | null;
  source_url: string | null;
  submitted_by_email: string | null;
  submitted_by_name: string | null;
  
  // Status
  status: FeedbackStatus;
  
  // Engagement
  upvote_count: number;
  similar_feedback_count: number;
  
  // Resolution
  resolution_notes: string | null;
  linked_epic_draft_id: string | null;
  linked_task_id: string | null;
  
  // Timeline
  feedback_date: string;
  resolved_date: string | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackInput {
  workspace_id: string;
  title: string;
  content: string;
  feedback_type: FeedbackType;
  priority?: FeedbackPriority;
  category?: string[];
  affected_feature?: string;
  source?: string;
  source_url?: string;
  submitted_by_email?: string;
  submitted_by_name?: string;
  feedback_date?: string;
}

export interface UpdateFeedbackInput {
  title?: string;
  content?: string;
  feedback_type?: FeedbackType;
  priority?: FeedbackPriority;
  category?: string[];
  affected_feature?: string;
  source?: string;
  source_url?: string;
  submitted_by_email?: string;
  submitted_by_name?: string;
  status?: FeedbackStatus;
  upvote_count?: number;
  similar_feedback_count?: number;
  resolution_notes?: string;
  linked_epic_draft_id?: string;
  linked_task_id?: string;
  resolved_date?: string;
}

export interface TrendingFeedback {
  category: string;
  count: number;
  recent_items: Feedback[];
}

// ============================================
// DISCOVERY HUB AGGREGATED DATA
// ============================================

export interface DiscoveryHubData {
  total_insights: number;
  insights_by_type: Record<InsightType, number>;
  total_experiments: number;
  experiments_by_status: Record<ExperimentStatus, number>;
  active_experiments: number;
  validated_hypotheses: number;
  invalidated_hypotheses: number;
  total_feedback: number;
  feedback_by_type: Record<FeedbackType, number>;
  feedback_by_status: Record<FeedbackStatus, number>;
  top_feedback_categories: TrendingFeedback[];
  recent_insights: UserInsight[];
}

// ============================================
// PHASE 2: STRATEGY CANVAS
// ============================================

export type StrategyStatus = 'draft' | 'active' | 'archived';

export interface ProductValue {
  value: string;
  description: string;
}

export interface StrategicBet {
  bet: string;
  rationale: string;
  horizon: string;
}

export interface Strategy {
  id: string;
  workspace_id: string;
  version: number;
  
  // North Star
  north_star_metric: string | null;
  north_star_definition: string | null;
  input_metrics: string[];
  
  // Vision & Narrative
  vision_statement: string | null;
  strategic_narrative: string | null;
  timeline_horizon: string | null;
  
  // Product Principles
  design_principles: string[];
  product_values: ProductValue[];
  anti_patterns: string[];
  
  // Competitive Positioning
  market_position: string | null;
  differentiation_strategy: string | null;
  competitor_matrix: Record<string, any>;
  
  // Strategic Bets
  strategic_bets: StrategicBet[];
  investment_areas: Record<string, any>;
  
  // Status
  status: StrategyStatus;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStrategyInput {
  workspace_id: string;
  north_star_metric?: string;
  north_star_definition?: string;
  input_metrics?: string[];
  vision_statement?: string;
  strategic_narrative?: string;
  timeline_horizon?: string;
  design_principles?: string[];
  product_values?: ProductValue[];
  anti_patterns?: string[];
  market_position?: string;
  differentiation_strategy?: string;
  competitor_matrix?: Record<string, any>;
  strategic_bets?: StrategicBet[];
  investment_areas?: Record<string, any>;
}

export interface UpdateStrategyInput {
  north_star_metric?: string;
  north_star_definition?: string;
  input_metrics?: string[];
  vision_statement?: string;
  strategic_narrative?: string;
  timeline_horizon?: string;
  design_principles?: string[];
  product_values?: ProductValue[];
  anti_patterns?: string[];
  market_position?: string;
  differentiation_strategy?: string;
  competitor_matrix?: Record<string, any>;
  strategic_bets?: StrategicBet[];
  investment_areas?: Record<string, any>;
  status?: StrategyStatus;
}

// ============================================
// PHASE 2: ROADMAP PLANNER - ROADMAP ITEMS
// ============================================

export type RoadmapItemType = 'feature' | 'theme' | 'epic' | 'initiative';
export type RoadmapBucket = 'now' | 'next' | 'later' | 'icebox';
export type RoadmapStatus = 'planned' | 'in_progress' | 'shipped' | 'cancelled';
export type RoadmapConfidence = 'low' | 'medium' | 'high';

export interface RoadmapItem {
  id: string;
  workspace_id: string;
  
  // Item Definition
  title: string;
  description: string | null;
  item_type: RoadmapItemType;
  
  // Prioritization (RICE)
  priority_score: number | null;
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  
  // Roadmap Placement
  roadmap_bucket: RoadmapBucket;
  target_quarter: string | null;
  target_release: string | null;
  
  // Dependencies
  depends_on_ids: string[];
  blocks_ids: string[];
  
  // Status
  status: RoadmapStatus;
  confidence_level: RoadmapConfidence;
  
  // Relationships
  linked_epic_draft_id: string | null;
  linked_clarity_spec_id: string | null;
  linked_strategy_bet: string | null;
  
  // Timeline
  start_date: string | null;
  ship_date: string | null;
  actual_ship_date: string | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRoadmapItemInput {
  workspace_id: string;
  title: string;
  description?: string;
  item_type: RoadmapItemType;
  roadmap_bucket?: RoadmapBucket;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  target_quarter?: string;
  target_release?: string;
  linked_epic_draft_id?: string;
  linked_clarity_spec_id?: string;
  linked_strategy_bet?: string;
}

export interface UpdateRoadmapItemInput {
  title?: string;
  description?: string;
  item_type?: RoadmapItemType;
  priority_score?: number;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  roadmap_bucket?: RoadmapBucket;
  target_quarter?: string;
  target_release?: string;
  depends_on_ids?: string[];
  blocks_ids?: string[];
  status?: RoadmapStatus;
  confidence_level?: RoadmapConfidence;
  linked_epic_draft_id?: string;
  linked_clarity_spec_id?: string;
  linked_strategy_bet?: string;
  start_date?: string;
  ship_date?: string;
  actual_ship_date?: string;
}

// ============================================
// PHASE 2: ROADMAP PLANNER - RELEASES
// ============================================

export type ReleaseType = 'major' | 'minor' | 'patch' | 'beta';
export type ReleaseStatus = 'planning' | 'in_progress' | 'testing' | 'shipped' | 'cancelled';

export interface Release {
  id: string;
  workspace_id: string;
  
  // Release Definition
  release_name: string;
  release_type: ReleaseType;
  description: string | null;
  
  // Goals
  release_goals: string[];
  target_audience: string | null;
  
  // Features
  included_roadmap_item_ids: string[];
  feature_flags: Record<string, string>;
  
  // Status
  status: ReleaseStatus;
  
  // Timeline
  planned_date: string | null;
  actual_date: string | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReleaseInput {
  workspace_id: string;
  release_name: string;
  release_type: ReleaseType;
  description?: string;
  release_goals?: string[];
  target_audience?: string;
  planned_date?: string;
}

export interface UpdateReleaseInput {
  release_name?: string;
  release_type?: ReleaseType;
  description?: string;
  release_goals?: string[];
  target_audience?: string;
  included_roadmap_item_ids?: string[];
  feature_flags?: Record<string, string>;
  status?: ReleaseStatus;
  planned_date?: string;
  actual_date?: string;
}

// ============================================
// PHASE 3: STAKEHOLDER HUB
// ============================================

export type PowerLevel = 'low' | 'medium' | 'high';
export type InterestLevel = 'low' | 'medium' | 'high';
export type AlignmentStatus = 'champion' | 'supporter' | 'neutral' | 'skeptical' | 'blocker';
export type UpdateType = 'email' | 'meeting' | 'demo' | 'presentation' | 'report' | 'slack';
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface Stakeholder {
  id: string;
  workspace_id: string;
  name: string;
  role: string | null;
  department: string | null;
  email: string | null;
  power_level: PowerLevel | null;
  interest_level: InterestLevel | null;
  influence_type: string | null;
  preferred_communication: string | null;
  communication_frequency: string | null;
  alignment_status: AlignmentStatus;
  last_contacted_at: string | null;
  key_concerns: string[];
  key_interests: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStakeholderInput {
  workspace_id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
  power_level?: PowerLevel;
  interest_level?: InterestLevel;
  influence_type?: string;
  preferred_communication?: string;
  communication_frequency?: string;
  alignment_status?: AlignmentStatus;
  key_concerns?: string[];
  key_interests?: string[];
}

export interface UpdateStakeholderInput {
  name?: string;
  role?: string;
  department?: string;
  email?: string;
  power_level?: PowerLevel;
  interest_level?: InterestLevel;
  influence_type?: string;
  preferred_communication?: string;
  communication_frequency?: string;
  alignment_status?: AlignmentStatus;
  last_contacted_at?: string;
  key_concerns?: string[];
  key_interests?: string[];
}

export interface StakeholderUpdate {
  id: string;
  workspace_id: string;
  update_type: UpdateType;
  title: string;
  summary: string | null;
  full_content: string | null;
  stakeholder_ids: string[];
  feedback_received: any[];
  approval_status: ApprovalStatus | null;
  action_items: any[];
  linked_clarity_spec_id: string | null;
  linked_epic_draft_id: string | null;
  linked_roadmap_item_id: string | null;
  sent_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStakeholderUpdateInput {
  workspace_id: string;
  update_type: UpdateType;
  title: string;
  summary?: string;
  full_content?: string;
  stakeholder_ids?: string[];
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  linked_roadmap_item_id?: string;
  sent_date?: string;
}

export interface UpdateStakeholderUpdateInput {
  update_type?: UpdateType;
  title?: string;
  summary?: string;
  full_content?: string;
  stakeholder_ids?: string[];
  feedback_received?: any[];
  approval_status?: ApprovalStatus;
  action_items?: any[];
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  linked_roadmap_item_id?: string;
  sent_date?: string;
}

export interface PowerInterestMatrix {
  high_power_high_interest: Stakeholder[];
  high_power_low_interest: Stakeholder[];
  low_power_high_interest: Stakeholder[];
  low_power_low_interest: Stakeholder[];
}

// ============================================
// EXTENDED WORKSPACE CONTEXT (for AI)
// ============================================

export interface ExtendedWorkspaceContext {
  metrics: {
    total_metrics: number;
    metrics_on_track: number;
    metrics_at_risk: number;
    recent_metrics: Array<{
      metric_name: string;
      current_value: number | null;
      target_value: number | null;
      health_status: string | null;
    }>;
  };
  
  discovery: {
    total_insights: number;
    total_experiments: number;
    active_experiments: number;
    validated_hypotheses: number;
    top_feedback_themes: string[];
    recent_insights: Array<{
      title: string;
      insight_type: string;
      pain_points: string[];
    }>;
  };
  
  strategy: {
    exists: boolean;
    north_star_metric?: string;
    vision_statement?: string;
    strategic_bets?: string[];
    product_principles?: string[];
  };
  
  roadmap: {
    total_items: number;
    by_bucket: {
      now: number;
      next: number;
      later: number;
    };
    upcoming_releases: Array<{
      release_name: string;
      planned_date: string;
      included_features: number;
    }>;
  };
  
  stakeholders: {
    total_stakeholders: number;
    by_alignment: {
      champion: number;
      supporter: number;
      neutral: number;
      skeptical: number;
      blocker: number;
    };
    pending_approvals: number;
  };
}

