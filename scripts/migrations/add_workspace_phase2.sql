-- Product Workspace Phase 2 Migration
-- Strategy Canvas + Roadmap Planner
-- Creates tables for defining product strategy and planning roadmaps

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STRATEGY CANVAS TABLE
-- ============================================
-- Define overarching product strategy, north star, principles, positioning

CREATE TABLE IF NOT EXISTS workspace_strategy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  
  -- North Star
  north_star_metric TEXT,
  north_star_definition TEXT,
  input_metrics JSONB DEFAULT '[]', -- Metrics that drive north star
  
  -- Vision & Narrative
  vision_statement TEXT,
  strategic_narrative TEXT,
  timeline_horizon TEXT, -- e.g., "12 months", "3 years"
  
  -- Product Principles
  design_principles JSONB DEFAULT '[]',
  product_values JSONB DEFAULT '[]', -- [{value, description}]
  anti_patterns JSONB DEFAULT '[]', -- Things we explicitly don't do
  
  -- Competitive Positioning
  market_position TEXT,
  differentiation_strategy TEXT,
  competitor_matrix JSONB DEFAULT '{}', -- {competitor: {features}}
  
  -- Strategic Bets
  strategic_bets JSONB DEFAULT '[]', -- [{bet, rationale, horizon}]
  investment_areas JSONB DEFAULT '{}', -- Horizon 1/2/3 breakdown
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROADMAP ITEMS TABLE
-- ============================================
-- Roadmap features/themes with prioritization

CREATE TABLE IF NOT EXISTS workspace_roadmap_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Item Definition
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('feature', 'theme', 'epic', 'initiative')),
  
  -- Prioritization (RICE scoring)
  priority_score INT, -- RICE/ICE score
  reach INT, -- RICE: Users impacted
  impact INT, -- RICE: Impact scale 0-3
  confidence INT, -- RICE: Confidence %
  effort INT, -- RICE: Person-months
  
  -- Roadmap Placement
  roadmap_bucket TEXT NOT NULL DEFAULT 'later' CHECK (roadmap_bucket IN ('now', 'next', 'later', 'icebox')),
  target_quarter TEXT, -- e.g., "Q1 2025"
  target_release TEXT, -- e.g., "v2.0"
  
  -- Dependencies
  depends_on_ids JSONB DEFAULT '[]', -- Other roadmap item IDs
  blocks_ids JSONB DEFAULT '[]',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'shipped', 'cancelled')),
  confidence_level TEXT NOT NULL DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
  
  -- Relationships
  linked_epic_draft_id UUID REFERENCES epic_drafts(id) ON DELETE SET NULL,
  linked_clarity_spec_id UUID REFERENCES clarity_specs(id) ON DELETE SET NULL,
  linked_strategy_bet TEXT, -- Which strategic bet this serves
  
  -- Timeline
  start_date DATE,
  ship_date DATE,
  actual_ship_date DATE,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- RELEASES TABLE
-- ============================================
-- Release/version planning

CREATE TABLE IF NOT EXISTS workspace_releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
  
  -- Release Definition
  release_name TEXT NOT NULL, -- e.g., "v2.0", "Spring Release"
  release_type TEXT NOT NULL CHECK (release_type IN ('major', 'minor', 'patch', 'beta')),
  description TEXT,
  
  -- Goals
  release_goals JSONB DEFAULT '[]',
  target_audience TEXT,
  
  -- Features
  included_roadmap_item_ids JSONB DEFAULT '[]',
  feature_flags JSONB DEFAULT '{}', -- {feature: flag_name}
  
  -- Status
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'testing', 'shipped', 'cancelled')),
  
  -- Timeline
  planned_date DATE,
  actual_date DATE,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Strategy
CREATE INDEX IF NOT EXISTS idx_workspace_strategy_workspace_id ON workspace_strategy(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_strategy_status ON workspace_strategy(status);
CREATE INDEX IF NOT EXISTS idx_workspace_strategy_version ON workspace_strategy(workspace_id, version DESC);

-- Roadmap Items
CREATE INDEX IF NOT EXISTS idx_workspace_roadmap_items_workspace_id ON workspace_roadmap_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_roadmap_items_bucket ON workspace_roadmap_items(roadmap_bucket);
CREATE INDEX IF NOT EXISTS idx_workspace_roadmap_items_status ON workspace_roadmap_items(status);
CREATE INDEX IF NOT EXISTS idx_workspace_roadmap_items_priority ON workspace_roadmap_items(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_roadmap_items_linked_epic ON workspace_roadmap_items(linked_epic_draft_id);
CREATE INDEX IF NOT EXISTS idx_workspace_roadmap_items_linked_clarity ON workspace_roadmap_items(linked_clarity_spec_id);

-- Releases
CREATE INDEX IF NOT EXISTS idx_workspace_releases_workspace_id ON workspace_releases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_releases_status ON workspace_releases(status);
CREATE INDEX IF NOT EXISTS idx_workspace_releases_planned_date ON workspace_releases(planned_date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE workspace_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_releases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - STRATEGY
-- ============================================

CREATE POLICY "Users can read strategy in their organization"
  ON workspace_strategy FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert strategy in their organization"
  ON workspace_strategy FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update strategy in their organization"
  ON workspace_strategy FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete strategy in their organization"
  ON workspace_strategy FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS POLICIES - ROADMAP ITEMS
-- ============================================

CREATE POLICY "Users can read roadmap items in their organization"
  ON workspace_roadmap_items FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert roadmap items in their organization"
  ON workspace_roadmap_items FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update roadmap items in their organization"
  ON workspace_roadmap_items FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete roadmap items in their organization"
  ON workspace_roadmap_items FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS POLICIES - RELEASES
-- ============================================

CREATE POLICY "Users can read releases in their organization"
  ON workspace_releases FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert releases in their organization"
  ON workspace_releases FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update releases in their organization"
  ON workspace_releases FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM project_workspaces 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete releases in their organization"
  ON workspace_releases FOR DELETE
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

CREATE TRIGGER update_workspace_strategy_updated_at
  BEFORE UPDATE ON workspace_strategy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_roadmap_items_updated_at
  BEFORE UPDATE ON workspace_roadmap_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_releases_updated_at
  BEFORE UPDATE ON workspace_releases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE workspace_strategy IS 'Product strategy definition including north star, vision, principles, and positioning';
COMMENT ON TABLE workspace_roadmap_items IS 'Roadmap features/themes with RICE prioritization and dependency tracking';
COMMENT ON TABLE workspace_releases IS 'Release planning and version tracking';

-- Phase 2 Migration Complete

