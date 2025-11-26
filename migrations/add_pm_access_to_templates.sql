-- Add PM (Project Manager) access to templates
-- This allows PMs to view, create, update, and delete templates (same as admins, except user management)
-- 
-- IMPORTANT: This migration is idempotent - safe to run multiple times
-- It uses DROP POLICY IF EXISTS followed by CREATE POLICY, so existing policies will be replaced
-- No data will be lost, only policy definitions will be updated
--
-- If you prefer to run this in smaller chunks, see:
-- - migrations/add_pm_template_access_part1.sql (project_templates policies)
-- - migrations/add_pm_template_access_part2.sql (template_phases policies)
-- - migrations/add_pm_template_access_part3.sql (field configs and groups policies)

-- Drop existing policies that need to be updated
-- Drop old policies (if they exist)
DROP POLICY IF EXISTS "Admins can view all templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can create templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can update templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can delete templates" ON project_templates;
DROP POLICY IF EXISTS "Only admins can manage template phases" ON template_phases;
DROP POLICY IF EXISTS "Only admins can manage template field configs" ON template_field_configs;
DROP POLICY IF EXISTS "Only admins can manage template field groups" ON template_field_groups;

-- Drop new policies (if they already exist from a previous run)
DROP POLICY IF EXISTS "Admins and PMs can view all templates" ON project_templates;
DROP POLICY IF EXISTS "Admins and PMs can create templates" ON project_templates;
DROP POLICY IF EXISTS "Admins and PMs can update templates" ON project_templates;
DROP POLICY IF EXISTS "Admins can delete all templates, PMs can delete their own" ON project_templates;
DROP POLICY IF EXISTS "Admins and PMs can manage template phases" ON template_phases;
DROP POLICY IF EXISTS "Admins and PMs can manage template field configs" ON template_field_configs;
DROP POLICY IF EXISTS "Admins and PMs can manage template field groups" ON template_field_groups;
DROP POLICY IF EXISTS "Users can view template phases for accessible templates" ON template_phases;
DROP POLICY IF EXISTS "Users can view template field configs for accessible templates" ON template_field_configs;
DROP POLICY IF EXISTS "Users can view template field groups for accessible templates" ON template_field_groups;

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

-- Update template_phases policy: Allow admins and PMs to manage template phases
CREATE POLICY "Admins and PMs can manage template phases"
  ON template_phases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'pm')
    )
  );

-- Update template_field_configs policy: Allow admins and PMs to manage field configs
CREATE POLICY "Admins and PMs can manage template field configs"
  ON template_field_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'pm')
    )
  );

-- Update template_field_groups policy: Allow admins and PMs to manage field groups
CREATE POLICY "Admins and PMs can manage template field groups"
  ON template_field_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'pm')
    )
  );

-- Also update the SELECT policy for template_phases to allow PMs
DROP POLICY IF EXISTS "Users can view template phases for accessible templates" ON template_phases;

CREATE POLICY "Users can view template phases for accessible templates"
  ON template_phases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_templates
      WHERE project_templates.id = template_phases.template_id
      AND (
        project_templates.is_public = true
        OR project_templates.created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.auth_id = auth.uid()
          AND users.role IN ('admin', 'pm')
        )
      )
    )
  );

-- Update template_field_configs SELECT policy to allow PMs
DROP POLICY IF EXISTS "Users can view template field configs for accessible templates" ON template_field_configs;

CREATE POLICY "Users can view template field configs for accessible templates"
  ON template_field_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_templates
      WHERE project_templates.id = template_field_configs.template_id
      AND (
        project_templates.is_public = true
        OR project_templates.created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.auth_id = auth.uid()
          AND users.role IN ('admin', 'pm')
        )
      )
    )
  );

-- Update template_field_groups SELECT policy to allow PMs
DROP POLICY IF EXISTS "Users can view template field groups for accessible templates" ON template_field_groups;

CREATE POLICY "Users can view template field groups for accessible templates"
  ON template_field_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_templates
      WHERE project_templates.id = template_field_groups.template_id
      AND (
        project_templates.is_public = true
        OR project_templates.created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.auth_id = auth.uid()
          AND users.role IN ('admin', 'pm')
        )
      )
    )
  );

