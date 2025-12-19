-- Product Workspace Phase 1 Migration
-- Success Metrics Dashboard + Discovery Hub
-- Creates tables for tracking metrics, user insights, experiments, and feedback

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUCCESS METRICS TABLE
-- ============================================
-- Track KPIs, product health, and business impact metrics

CREATE TABLE IF NOT EXISTS workspace_success_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Metric Definition
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('kpi', 'product_health', 'business_impact', 'technical')),
  description TEXT,
  
  -- Targets & Values
  target_value DECIMAL,
  current_value DECIMAL,
  unit TEXT, -- e.g., '%', '$', 'users', 'ms'
  
  -- Tracking
  measurement_frequency TEXT, -- daily, weekly, monthly
  data_source TEXT, -- Where metric comes from
  data_points JSONB DEFAULT '[]', -- Historical values [{date, value}]
  
  -- Relationships
  linked_clarity_spec_id UUID REFERENCES clarity_specs(id) ON DELETE SET NULL,
  linked_epic_draft_id UUID REFERENCES epic_drafts(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  health_status TEXT CHECK (health_status IN ('on_track', 'at_risk', 'off_track')),
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USER INSIGHTS TABLE
-- ============================================
-- User research repository (interviews, surveys, feedback)

CREATE TABLE IF NOT EXISTS workspace_user_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Insight Type
  insight_type TEXT NOT NULL CHECK (insight_type IN ('interview', 'feedback', 'survey', 'support_ticket', 'usability_test')),
  
  -- Content
  title TEXT NOT NULL,
  summary TEXT,
  full_content TEXT,
  source TEXT, -- Where it came from
  
  -- Extracted Insights
  pain_points JSONB DEFAULT '[]',
  feature_requests JSONB DEFAULT '[]',
  quotes JSONB DEFAULT '[]', -- [{quote, speaker, context}]
  tags JSONB DEFAULT '[]',
  
  -- User Context
  user_segment TEXT,
  user_role TEXT,
  
  -- Validation
  validated_assumptions JSONB DEFAULT '[]',
  invalidated_assumptions JSONB DEFAULT '[]',
  
  -- Relationships
  linked_clarity_spec_id UUID REFERENCES clarity_specs(id) ON DELETE SET NULL,
  
  -- Metadata
  insight_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- EXPERIMENTS TABLE
-- ============================================
-- Validation experiments tracking

CREATE TABLE IF NOT EXISTS workspace_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Experiment Definition
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  experiment_type TEXT NOT NULL CHECK (experiment_type IN ('ab_test', 'prototype', 'landing_page', 'concierge', 'wizard_of_oz', 'interview')),
  
  -- Setup
  description TEXT,
  success_criteria JSONB DEFAULT '[]',
  target_sample_size INT,
  
  -- Results
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'cancelled')),
  actual_sample_size INT,
  results_summary TEXT,
  key_learnings JSONB DEFAULT '[]',
  
  -- Decision
  hypothesis_validated BOOLEAN,
  confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high')),
  next_actions JSONB DEFAULT '[]',
  
  -- Timeline
  start_date DATE,
  end_date DATE,
  
  -- Relationships
  linked_clarity_spec_id UUID REFERENCES clarity_specs(id) ON DELETE SET NULL,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- FEEDBACK TABLE
-- ============================================
-- Aggregated customer feedback

CREATE TABLE IF NOT EXISTS workspace_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Feedback Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('feature_request', 'bug_report', 'complaint', 'praise', 'question')),
  
  -- Classification
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category JSONB DEFAULT '[]', -- Multiple categories possible
  affected_feature TEXT,
  
  -- Source
  source TEXT, -- Zendesk, Intercom, Email, Sales, etc.
  source_url TEXT,
  submitted_by_email TEXT,
  submitted_by_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'planned', 'in_progress', 'shipped', 'wont_do', 'duplicate')),
  
  -- Engagement
  upvote_count INT DEFAULT 0,
  similar_feedback_count INT DEFAULT 0,
  
  -- Resolution
  resolution_notes TEXT,
  linked_epic_draft_id UUID REFERENCES epic_drafts(id) ON DELETE SET NULL,
  linked_task_id UUID, -- Reference to project_tasks
  
  -- Timeline
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved_date DATE,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Success Metrics
CREATE INDEX IF NOT EXISTS idx_workspace_success_metrics_workspace_id ON workspace_success_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_success_metrics_metric_type ON workspace_success_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_workspace_success_metrics_status ON workspace_success_metrics(status);
CREATE INDEX IF NOT EXISTS idx_workspace_success_metrics_health_status ON workspace_success_metrics(health_status);
CREATE INDEX IF NOT EXISTS idx_workspace_success_metrics_linked_clarity_spec ON workspace_success_metrics(linked_clarity_spec_id);
CREATE INDEX IF NOT EXISTS idx_workspace_success_metrics_linked_epic_draft ON workspace_success_metrics(linked_epic_draft_id);

-- User Insights
CREATE INDEX IF NOT EXISTS idx_workspace_user_insights_workspace_id ON workspace_user_insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_user_insights_insight_type ON workspace_user_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_workspace_user_insights_insight_date ON workspace_user_insights(insight_date);
CREATE INDEX IF NOT EXISTS idx_workspace_user_insights_linked_clarity_spec ON workspace_user_insights(linked_clarity_spec_id);

-- Experiments
CREATE INDEX IF NOT EXISTS idx_workspace_experiments_workspace_id ON workspace_experiments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_experiments_status ON workspace_experiments(status);
CREATE INDEX IF NOT EXISTS idx_workspace_experiments_experiment_type ON workspace_experiments(experiment_type);
CREATE INDEX IF NOT EXISTS idx_workspace_experiments_linked_clarity_spec ON workspace_experiments(linked_clarity_spec_id);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_workspace_id ON workspace_feedback(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_feedback_type ON workspace_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_status ON workspace_feedback(status);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_priority ON workspace_feedback(priority);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_feedback_date ON workspace_feedback(feedback_date);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_linked_epic_draft ON workspace_feedback(linked_epic_draft_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE workspace_success_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - SUCCESS METRICS
-- ============================================

CREATE POLICY "Users can read metrics in their organization"
  ON workspace_success_metrics FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert metrics in their organization"
  ON workspace_success_metrics FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update metrics in their organization"
  ON workspace_success_metrics FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete metrics in their organization"
  ON workspace_success_metrics FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS POLICIES - USER INSIGHTS
-- ============================================

CREATE POLICY "Users can read insights in their organization"
  ON workspace_user_insights FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert insights in their organization"
  ON workspace_user_insights FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update insights in their organization"
  ON workspace_user_insights FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete insights in their organization"
  ON workspace_user_insights FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS POLICIES - EXPERIMENTS
-- ============================================

CREATE POLICY "Users can read experiments in their organization"
  ON workspace_experiments FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert experiments in their organization"
  ON workspace_experiments FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update experiments in their organization"
  ON workspace_experiments FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete experiments in their organization"
  ON workspace_experiments FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS POLICIES - FEEDBACK
-- ============================================

CREATE POLICY "Users can read feedback in their organization"
  ON workspace_feedback FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert feedback in their organization"
  ON workspace_feedback FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update feedback in their organization"
  ON workspace_feedback FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete feedback in their organization"
  ON workspace_feedback FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Triggers for each table
CREATE TRIGGER update_workspace_success_metrics_updated_at
  BEFORE UPDATE ON workspace_success_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_user_insights_updated_at
  BEFORE UPDATE ON workspace_user_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_experiments_updated_at
  BEFORE UPDATE ON workspace_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_feedback_updated_at
  BEFORE UPDATE ON workspace_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE workspace_success_metrics IS 'Track KPIs, product health metrics, and business impact measurements';
COMMENT ON TABLE workspace_user_insights IS 'Repository for user interviews, surveys, feedback, and research insights';
COMMENT ON TABLE workspace_experiments IS 'Track validation experiments, A/B tests, prototypes, and hypothesis testing';
COMMENT ON TABLE workspace_feedback IS 'Aggregated customer feedback from various sources with prioritization and tracking';

-- Phase 1 Migration Complete

