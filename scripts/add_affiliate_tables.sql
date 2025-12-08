-- Migration: Add affiliate codes and conversions tables
-- Run this in Supabase SQL Editor

-- Affiliate codes table
CREATE TABLE IF NOT EXISTS affiliate_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Discount configuration
  discount_type text CHECK (discount_type IN ('percentage', 'fixed_amount', 'trial_extension')) DEFAULT 'percentage',
  discount_value numeric DEFAULT 0,
  discount_duration_months integer DEFAULT NULL, -- NULL = forever, else N months
  
  -- Trial extension (can stack with package trial)
  bonus_trial_days integer DEFAULT 0,
  
  -- Affiliate owner (optional - for tracking payouts)
  affiliate_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  affiliate_email text,
  commission_percentage numeric DEFAULT 0,
  
  -- Limits
  max_uses integer DEFAULT NULL, -- NULL = unlimited
  current_uses integer DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz DEFAULT NULL,
  
  -- Targeting
  applicable_package_ids uuid[] DEFAULT NULL, -- NULL = all packages
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Track affiliate conversions
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_code_id uuid REFERENCES affiliate_codes(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Snapshot of discount applied
  discount_type text,
  discount_value numeric,
  discount_applied numeric, -- Actual dollar amount saved
  
  -- Attribution
  converted_at timestamptz DEFAULT now(),
  first_payment_at timestamptz,
  
  -- Commission tracking
  commission_amount numeric DEFAULT 0,
  commission_paid boolean DEFAULT false,
  commission_paid_at timestamptz
);

-- Add affiliate tracking to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS affiliate_code_id uuid REFERENCES affiliate_codes(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS affiliate_code_used text;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_code ON affiliate_codes(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_active ON affiliate_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_code_id ON affiliate_conversions(affiliate_code_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_org_id ON affiliate_conversions(organization_id);

-- Add comments for documentation
COMMENT ON TABLE affiliate_codes IS 'Affiliate/referral codes for tracking signups and applying discounts';
COMMENT ON TABLE affiliate_conversions IS 'Tracks when affiliate codes are used and conversion metrics';
COMMENT ON COLUMN affiliate_codes.discount_type IS 'Type of discount: percentage, fixed_amount, or trial_extension';
COMMENT ON COLUMN affiliate_codes.discount_duration_months IS 'How long discount applies (NULL = forever)';
COMMENT ON COLUMN affiliate_codes.bonus_trial_days IS 'Additional trial days added on top of package trial';
COMMENT ON COLUMN affiliate_codes.applicable_package_ids IS 'Limit code to specific packages (NULL = all packages)';

-- Enable RLS
ALTER TABLE affiliate_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliate_codes (super admin only for now)
CREATE POLICY "Super admins can manage affiliate codes"
  ON affiliate_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_id = auth.uid() 
      AND users.is_super_admin = true
    )
  );

-- RLS Policies for affiliate_conversions (super admin only for now)
CREATE POLICY "Super admins can manage affiliate conversions"
  ON affiliate_conversions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_id = auth.uid() 
      AND users.is_super_admin = true
    )
  );

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('affiliate_codes', 'affiliate_conversions');

