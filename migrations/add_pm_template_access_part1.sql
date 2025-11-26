-- Part 1: Update project_templates policies to allow PMs
-- This migration is idempotent - safe to run multiple times
-- It drops and recreates policies, so existing policies will be replaced

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Admins can view all templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can create templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can update templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can delete templates" ON project_templates;
DROP POLICY IF EXISTS "Admins and PMs can view all templates" ON project_templates;
DROP POLICY IF EXISTS "Admins and PMs can create templates" ON project_templates;
DROP POLICY IF EXISTS "Admins and PMs can update templates" ON project_templates;
DROP POLICY IF EXISTS "Admins can delete all templates, PMs can delete their own" ON project_templates;

-- Update SELECT policy: Allow admins and PMs to view all templates
CREATE POLICY "Admins and PMs can view all templates"
  ON project_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'pm')
    )
  );

-- Update INSERT policy: Allow admins and PMs to create templates
CREATE POLICY "Admins and PMs can create templates"
  ON project_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'pm')
    )
  );

-- Update UPDATE policy: Allow admins and PMs to update templates
CREATE POLICY "Admins and PMs can update templates"
  ON project_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'pm')
    )
  );

-- Update DELETE policy: Admins can delete all, PMs can only delete their own
CREATE POLICY "Admins can delete all templates, PMs can delete their own"
  ON project_templates FOR DELETE
  USING (
    -- Admins can delete all templates
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
    OR
    -- PMs can only delete templates they created
    (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.auth_id = auth.uid()
        AND users.role = 'pm'
      )
      AND created_by = (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

