-- Create waitlist table for landing page email signups
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ -- When user was notified they can sign up
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Enable RLS (optional, but good practice)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can add to waitlist" ON waitlist;
DROP POLICY IF EXISTS "Admins can view waitlist" ON waitlist;

-- Allow anyone to insert into waitlist (for public landing page)
CREATE POLICY "Anyone can add to waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- Only admins can view waitlist
CREATE POLICY "Admins can view waitlist"
  ON waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

