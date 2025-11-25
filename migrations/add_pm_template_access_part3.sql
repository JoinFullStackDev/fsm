-- Part 3: Update template_field_configs and template_field_groups policies to allow PMs
-- This migration is idempotent - safe to run multiple times

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Only admins can manage template field configs" ON template_field_configs;
DROP POLICY IF EXISTS "Admins and PMs can manage template field configs" ON template_field_configs;
DROP POLICY IF EXISTS "Users can view template field configs for accessible templates" ON template_field_configs;

DROP POLICY IF EXISTS "Only admins can manage template field groups" ON template_field_groups;
DROP POLICY IF EXISTS "Admins and PMs can manage template field groups" ON template_field_groups;
DROP POLICY IF EXISTS "Users can view template field groups for accessible templates" ON template_field_groups;

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

-- Update template_field_configs SELECT policy to allow PMs
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

-- Update template_field_groups SELECT policy to allow PMs
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

