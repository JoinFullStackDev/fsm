-- Add user_id and file_size columns to exports table
-- Run this in your Supabase SQL Editor

-- Add user_id column to track who created the export
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Add file_size column to track export file size (in bytes)
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS file_size bigint;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_project_id_created_at ON exports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_export_type ON exports(export_type);

-- Add comment for documentation
COMMENT ON COLUMN exports.user_id IS 'User who created this export';
COMMENT ON COLUMN exports.file_size IS 'File size in bytes (null for on-demand exports)';

