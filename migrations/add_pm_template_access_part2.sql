-- Part 2: Update template_phases policies to allow PMs
-- This migration is idempotent - safe to run multiple times

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Only admins can manage template phases" ON template_phases;
DROP POLICY IF EXISTS "Admins and PMs can manage template phases" ON template_phases;
DROP POLICY IF EXISTS "Users can view template phases for accessible templates" ON template_phases;

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

-- Update SELECT policy for template_phases to allow PMs
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

