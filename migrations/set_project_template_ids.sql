-- Safe migration to set template_id on projects that don't have one
-- This matches projects to templates based on their phase structure
-- Only updates projects where we can confidently match

-- Step 1: Create a function to match projects to templates
-- This function matches projects to templates based on exact phase structure match
CREATE OR REPLACE FUNCTION match_project_to_template(project_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  matched_template_id uuid;
  project_phase_count int;
BEGIN
  -- Get project phase count
  SELECT COUNT(*) INTO project_phase_count
  FROM project_phases
  WHERE project_id = project_uuid
    AND is_active = true;
  
  -- Find templates with matching phase structure
  -- Match by: same number of phases AND all phase numbers/names match exactly
  SELECT t.template_id
  INTO matched_template_id
  FROM (
    SELECT 
      tp.template_id,
      COUNT(*) as phase_count,
      -- Count exact phase matches (same phase_number AND phase_name)
      COUNT(CASE 
        WHEN EXISTS (
          SELECT 1 FROM project_phases pp
          WHERE pp.project_id = project_uuid
            AND pp.phase_number = tp.phase_number
            AND pp.phase_name = tp.phase_name
            AND pp.is_active = true
        ) THEN 1
      END) as exact_matches
    FROM template_phases tp
    WHERE tp.is_active = true
    GROUP BY tp.template_id
  ) t
  WHERE t.phase_count = project_phase_count
    AND t.exact_matches = project_phase_count  -- All phases must match exactly
    AND t.template_id != '19c71e39-85a2-46d3-b195-adbd5b955854'  -- Skip default template if others match
  ORDER BY t.exact_matches DESC, t.phase_count DESC
  LIMIT 1;
  
  RETURN matched_template_id;
END;
$$;

-- Step 2: Update projects that don't have template_id
-- Only update if we can find a confident match
UPDATE projects p
SET template_id = match_project_to_template(p.id)
WHERE p.template_id IS NULL
  AND match_project_to_template(p.id) IS NOT NULL;

-- Step 3: Clean up the function (optional - you can keep it for future use)
-- DROP FUNCTION IF EXISTS match_project_to_template(uuid);

-- Verification query: Check which projects were updated
SELECT 
  p.id,
  p.name,
  p.template_id,
  pt.name as template_name,
  COUNT(DISTINCT pp.phase_number) as project_phase_count,
  COUNT(DISTINCT tp.phase_number) as template_phase_count
FROM projects p
LEFT JOIN project_templates pt ON pt.id = p.template_id
LEFT JOIN project_phases pp ON pp.project_id = p.id AND pp.is_active = true
LEFT JOIN template_phases tp ON tp.template_id = p.template_id AND tp.is_active = true
WHERE p.template_id IS NOT NULL
GROUP BY p.id, p.name, p.template_id, pt.name
ORDER BY p.name;

