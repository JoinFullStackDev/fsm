-- Fix RLS policy for updating project phases to allow project members
-- This allows project members (not just owners) to update phase data

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update project phases" ON project_phases;

-- Create new policy that allows both owners and project members to update
CREATE POLICY "Users can update project phases"
  ON project_phases FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Also fix the INSERT policy to allow project members
DROP POLICY IF EXISTS "Users can insert project phases" ON project_phases;

CREATE POLICY "Users can insert project phases"
  ON project_phases FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

