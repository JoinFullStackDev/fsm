-- Migration: Remove legacy role column from project_members table
-- This column was causing confusion with organization_role_id
-- The role column was incorrectly used for both permission checks AND job function
-- Now we use: users.role for permissions, organization_role_id for job function
-- 
-- Date: 2024-12-11
-- Status: COMPLETED

-- ============================================================================
-- STEP 1: Check for any project_members without organization_role_id set
-- ============================================================================
-- Run this first to see if you need to backfill before dropping the column
/*
SELECT 
  COUNT(*) as members_without_org_role,
  (SELECT COUNT(*) FROM project_members) as total_members
FROM project_members 
WHERE organization_role_id IS NULL;
*/

-- ============================================================================
-- STEP 2: Backfill members without organization_role_id
-- ============================================================================
-- Maps the legacy role value to matching organization roles by name
/*
UPDATE project_members pm
SET organization_role_id = (
  SELECT org_role.id 
  FROM organization_roles org_role
  INNER JOIN projects p ON p.organization_id = org_role.organization_id
  WHERE p.id = pm.project_id
    AND LOWER(org_role.name) = LOWER(pm.role)
    AND org_role.is_default = true
  LIMIT 1
)
WHERE pm.organization_role_id IS NULL
  AND pm.role IS NOT NULL;
*/

-- ============================================================================
-- STEP 3: Update RLS policies that depended on project_members.role
-- ============================================================================
-- These policies were checking project_members.role for 'admin'/'pm'
-- Now they use the is_admin_or_pm() function which checks users.role

-- Drop old policies
DROP POLICY IF EXISTS "Users can manage allocations for projects they own or manage" ON project_member_allocations;
DROP POLICY IF EXISTS "Users can manage SOW members for projects they manage" ON sow_project_members;
DROP POLICY IF EXISTS "Users can manage SOW resource allocations for projects they man" ON sow_resource_allocations;

-- Recreate policies using users.role instead of project_members.role

-- Policy 1: project_member_allocations
CREATE POLICY "Users can manage allocations for projects they own or manage"
ON project_member_allocations
FOR ALL
USING (
  (project_id IN (SELECT id FROM projects WHERE owner_id = current_user_id()))
  OR is_admin_or_pm()
);

-- Policy 2: sow_project_members
CREATE POLICY "Users can manage SOW members for projects they manage"
ON sow_project_members
FOR ALL
USING (
  sow_id IN (
    SELECT psow.id
    FROM project_scope_of_work psow
    JOIN projects p ON psow.project_id = p.id
    WHERE p.owner_id = current_user_id()
       OR is_admin_or_pm()
  )
)
WITH CHECK (
  sow_id IN (
    SELECT psow.id
    FROM project_scope_of_work psow
    JOIN projects p ON psow.project_id = p.id
    WHERE p.owner_id = current_user_id()
       OR is_admin_or_pm()
  )
);

-- Policy 3: sow_resource_allocations
CREATE POLICY "Users can manage SOW resource allocations for projects they manage"
ON sow_resource_allocations
FOR ALL
USING (
  sow_id IN (
    SELECT id FROM project_scope_of_work
    WHERE project_id IN (
      SELECT id FROM projects WHERE owner_id = current_user_id()
    )
  )
  OR is_admin_or_pm()
);

-- ============================================================================
-- STEP 4: Drop the role column from project_members
-- ============================================================================
ALTER TABLE project_members DROP COLUMN IF EXISTS role;

-- ============================================================================
-- STEP 5: Verify the change was successful
-- ============================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'project_members'
ORDER BY ordinal_position;

-- Expected result should NOT include 'role' column, but SHOULD include:
-- id, project_id, user_id, organization_role_id, created_at
