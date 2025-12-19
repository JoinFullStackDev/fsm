-- Product Workspace Phase 3 Migration
-- Stakeholder Hub
-- Creates tables for managing stakeholders and communication

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STAKEHOLDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Stakeholder Info
  name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  email TEXT,
  
  -- Influence & Engagement
  power_level TEXT CHECK (power_level IN ('low', 'medium', 'high')),
  interest_level TEXT CHECK (interest_level IN ('low', 'medium', 'high')),
  influence_type TEXT, -- Decision maker, influencer, informed, consulted
  
  -- Communication
  preferred_communication TEXT,
  communication_frequency TEXT,
  
  -- Current Status
  alignment_status TEXT NOT NULL DEFAULT 'neutral' CHECK (alignment_status IN ('champion', 'supporter', 'neutral', 'skeptical', 'blocker')),
  last_contacted_at TIMESTAMPTZ,
  
  -- Concerns & Interests
  key_concerns JSONB DEFAULT '[]',
  key_interests JSONB DEFAULT '[]',
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STAKEHOLDER UPDATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_stakeholder_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Update Content
  update_type TEXT NOT NULL CHECK (update_type IN ('email', 'meeting', 'demo', 'presentation', 'report', 'slack')),
  title TEXT NOT NULL,
  summary TEXT,
  full_content TEXT,
  
  -- Recipients
  stakeholder_ids JSONB DEFAULT '[]',
  
  -- Feedback
  feedback_received JSONB DEFAULT '[]',
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'changes_requested', 'rejected')),
  
  -- Action Items
  action_items JSONB DEFAULT '[]',
  
  -- Relationships
  linked_clarity_spec_id UUID REFERENCES clarity_specs(id) ON DELETE SET NULL,
  linked_epic_draft_id UUID REFERENCES epic_drafts(id) ON DELETE SET NULL,
  linked_roadmap_item_id UUID,
  
  -- Timeline
  sent_date DATE,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Stakeholders
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholders_workspace_id ON workspace_stakeholders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholders_alignment ON workspace_stakeholders(alignment_status);
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholders_power ON workspace_stakeholders(power_level);
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholders_interest ON workspace_stakeholders(interest_level);

-- Updates
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholder_updates_workspace_id ON workspace_stakeholder_updates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholder_updates_type ON workspace_stakeholder_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_workspace_stakeholder_updates_sent_date ON workspace_stakeholder_updates(sent_date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE workspace_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_stakeholder_updates ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES - STAKEHOLDERS

CREATE POLICY "Users can read stakeholders in their organization"
  ON workspace_stakeholders FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert stakeholders in their organization"
  ON workspace_stakeholders FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update stakeholders in their organization"
  ON workspace_stakeholders FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete stakeholders in their organization"
  ON workspace_stakeholders FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- RLS POLICIES - UPDATES

CREATE POLICY "Users can read updates in their organization"
  ON workspace_stakeholder_updates FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert updates in their organization"
  ON workspace_stakeholder_updates FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update updates in their organization"
  ON workspace_stakeholder_updates FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete updates in their organization"
  ON workspace_stakeholder_updates FOR DELETE
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

CREATE TRIGGER update_workspace_stakeholders_updated_at
  BEFORE UPDATE ON workspace_stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_stakeholder_updates_updated_at
  BEFORE UPDATE ON workspace_stakeholder_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE workspace_stakeholders IS 'Stakeholder directory with influence mapping and engagement tracking';
COMMENT ON TABLE workspace_stakeholder_updates IS 'Communication log for stakeholder updates and feedback';

-- Phase 3 Migration Complete

