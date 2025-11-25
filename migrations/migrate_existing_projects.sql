-- Data Migration for Existing Projects
-- Run this in your Supabase SQL Editor

-- Set source='Manual' for all existing projects (if not already set)
update projects 
set source = 'Manual' 
where source is null or source not in ('Manual', 'Converted');

-- Ensure company_id remains null for existing projects (no change needed, but explicit)
-- This migration is idempotent and safe to run multiple times

