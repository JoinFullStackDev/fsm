-- Migration: Add organization_integrations table for Slack and future integrations
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Add 'slack' to system_connections allowed types
-- ============================================

-- Drop the existing check constraint and add a new one that includes 'slack'
ALTER TABLE system_connections 
DROP CONSTRAINT IF EXISTS system_connections_connection_type_check;

ALTER TABLE system_connections 
ADD CONSTRAINT system_connections_connection_type_check 
CHECK (connection_type IN ('stripe', 'email', 'ai', 'slack'));

-- Organization integrations table (for Slack, Teams, etc.)
CREATE TABLE IF NOT EXISTS organization_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  
  -- OAuth tokens (encrypted via application layer)
  access_token_encrypted text,
  bot_user_id text,
  
  -- Slack workspace info (reusable for other integrations)
  team_id text,
  team_name text,
  
  -- Configuration (channel mappings, notification preferences)
  config jsonb DEFAULT '{}'::jsonb,
  
  is_active boolean DEFAULT true,
  connected_by uuid REFERENCES users(id),
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, integration_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_integrations_org_id ON organization_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_type ON organization_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_org_integrations_active ON organization_integrations(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their organization's integrations
CREATE POLICY "Users can view their organization integrations"
  ON organization_integrations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid()
  ));

-- Organization admins can insert integrations
CREATE POLICY "Admins can insert organization integrations"
  ON organization_integrations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'admin'
  ));

-- Organization admins can update integrations
CREATE POLICY "Admins can update organization integrations"
  ON organization_integrations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'admin'
  ));

-- Organization admins can delete integrations
CREATE POLICY "Admins can delete organization integrations"
  ON organization_integrations FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'admin'
  ));

-- Add comments for documentation
COMMENT ON TABLE organization_integrations IS 'Stores OAuth tokens and configuration for third-party integrations like Slack';
COMMENT ON COLUMN organization_integrations.integration_type IS 'Type of integration: slack, teams, etc.';
COMMENT ON COLUMN organization_integrations.access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN organization_integrations.config IS 'JSON configuration for the integration (channels, notification preferences, etc.)';

-- Add slack_integration_enabled to all existing packages (default to false)
-- This adds the feature flag to each package's features JSONB
UPDATE packages 
SET features = COALESCE(features, '{}'::jsonb) || '{"slack_integration_enabled": false}'::jsonb
WHERE NOT (features ? 'slack_integration_enabled');
