-- Migration: Add custom enterprise packages table
-- Run this in Supabase SQL Editor

-- Custom enterprise packages (for specific organizations)
CREATE TABLE IF NOT EXISTS custom_enterprise_packages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL, -- Base package to extend
  
  -- Custom name for invoicing
  custom_name text,
  
  -- Override pricing (NULL = use package default)
  custom_price_per_user_monthly numeric DEFAULT NULL,
  custom_price_per_user_yearly numeric DEFAULT NULL,
  custom_base_price_monthly numeric DEFAULT NULL,
  custom_base_price_yearly numeric DEFAULT NULL,
  
  -- Volume discounts specific to this org
  -- Example: [{"min_users": 25, "discount_percent": 15}, {"min_users": 50, "discount_percent": 25}]
  volume_discount_rules jsonb DEFAULT '[]'::jsonb,
  
  -- Custom limits (override package features)
  custom_max_users integer DEFAULT NULL,
  custom_max_projects integer DEFAULT NULL,
  custom_max_templates integer DEFAULT NULL,
  
  -- Custom trial
  custom_trial_days integer DEFAULT NULL,
  
  -- Contract terms
  contract_start_date date DEFAULT NULL,
  contract_end_date date DEFAULT NULL,
  minimum_commitment_users integer DEFAULT NULL,
  minimum_commitment_months integer DEFAULT NULL,
  
  -- Billing
  custom_billing_interval text CHECK (custom_billing_interval IN ('month', 'quarter', 'year')) DEFAULT NULL,
  net_payment_terms integer DEFAULT 30, -- Net 30, Net 60, etc.
  
  -- Notes for admins
  notes text,
  
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add enterprise flag to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_enterprise boolean DEFAULT false;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS enterprise_contact_required boolean DEFAULT false;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS minimum_users integer DEFAULT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_enterprise_org_id ON custom_enterprise_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_enterprise_active ON custom_enterprise_packages(is_active) WHERE is_active = true;

-- Add comments for documentation
COMMENT ON TABLE custom_enterprise_packages IS 'Custom enterprise packages for specific organizations with special pricing and terms';
COMMENT ON COLUMN custom_enterprise_packages.volume_discount_rules IS 'JSON array of volume discount rules: [{min_users: number, discount_percent: number}]';
COMMENT ON COLUMN custom_enterprise_packages.net_payment_terms IS 'Net payment terms in days (e.g., 30 = Net 30)';
COMMENT ON COLUMN custom_enterprise_packages.minimum_commitment_users IS 'Minimum number of users organization must maintain';
COMMENT ON COLUMN custom_enterprise_packages.minimum_commitment_months IS 'Minimum contract length in months';

-- Enable RLS
ALTER TABLE custom_enterprise_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_enterprise_packages (super admin only for now)
CREATE POLICY "Super admins can manage enterprise packages"
  ON custom_enterprise_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_id = auth.uid() 
      AND users.is_super_admin = true
    )
  );

-- Verify table was created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'custom_enterprise_packages';

