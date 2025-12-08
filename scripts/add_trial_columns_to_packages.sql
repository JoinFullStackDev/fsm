-- Migration: Add trial configuration columns to packages table
-- Run this in Supabase SQL Editor

-- Add trial_days column (number of days for free trial)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0;

-- Add trial_enabled column (whether trial is enabled for this package)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS trial_enabled boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN packages.trial_days IS 'Number of days for free trial period before first payment';
COMMENT ON COLUMN packages.trial_enabled IS 'Whether free trial is enabled for this package';

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'packages' 
AND column_name IN ('trial_days', 'trial_enabled');

