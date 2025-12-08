-- Migration: Add affiliate applications table and is_affiliate flag
-- Run this in Supabase SQL Editor

-- Affiliate applications table for tracking affiliate requests
CREATE TABLE IF NOT EXISTS affiliate_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL, -- Must have account
  name text NOT NULL,
  email text NOT NULL,
  company_name text,
  website text,
  social_media_links jsonb DEFAULT '[]'::jsonb,
  audience_size text,
  audience_description text,
  promotion_methods text[],
  motivation text,
  status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now()
);

-- Add is_affiliate flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_affiliate boolean DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_user_id ON affiliate_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate) WHERE is_affiliate = true;

-- Add comments for documentation
COMMENT ON TABLE affiliate_applications IS 'Tracks affiliate program applications from users';
COMMENT ON COLUMN affiliate_applications.user_id IS 'User must have an account to apply';
COMMENT ON COLUMN affiliate_applications.social_media_links IS 'JSON array of social media profile URLs';
COMMENT ON COLUMN affiliate_applications.promotion_methods IS 'Array of methods user will use to promote';
COMMENT ON COLUMN users.is_affiliate IS 'Whether user is an approved affiliate partner';

-- Enable RLS
ALTER TABLE affiliate_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliate_applications
-- Users can view their own applications
CREATE POLICY "Users can view own applications"
  ON affiliate_applications FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Users can create their own applications
CREATE POLICY "Users can create own applications"
  ON affiliate_applications FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Super admins can manage all applications
CREATE POLICY "Super admins can manage applications"
  ON affiliate_applications FOR ALL
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
AND table_name = 'affiliate_applications';

