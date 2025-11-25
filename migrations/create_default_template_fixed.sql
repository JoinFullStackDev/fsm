-- Create default "FullStack Method Default" template with all field configurations
-- This migration creates the default template based on the current phase structure
-- Run this AFTER add_template_field_configs.sql

-- Create default template (idempotent - only creates if doesn't exist)
do $$
declare
  default_template_id uuid;
  admin_user_id uuid;
begin
  -- Get first admin user (or create template without created_by if no admin exists)
  select id into admin_user_id
  from users
  where role = 'admin'
  limit 1;

  -- Check if default template already exists
  select id into default_template_id
  from project_templates
  where name = 'FullStack Method Default'
  limit 1;

  -- Create template if it doesn't exist
  if default_template_id is null then
    insert into project_templates (
      name,
      description,
      created_by,
      is_public,
      category,
      version
    ) values (
      'FullStack Method Default',
      'Default template based on the current FullStack Method phase structure. This template includes all standard fields for all 6 phases with their current configurations.',
      admin_user_id,
      true,
      'default',
      '1.0.0'
    )
    returning id into default_template_id;
  end if;

  -- Create template phases with default empty data
  insert into template_phases (template_id, phase_number, data)
  select default_template_id, phase_num, '{}'::jsonb
  from generate_series(1, 6) as phase_num
  where not exists (
    select 1 from template_phases
    where template_id = default_template_id
    and phase_number = phase_num
  );

  -- Helper function to insert field config if not exists
  -- Phase 1
  perform insert_field_config(default_template_id, 1, 'problem_statement', 'textarea', 1, '{"label": "Problem Statement", "helpText": "Clearly define the problem your product solves. Be specific about pain points, who experiences them, and why existing solutions fall short.", "placeholder": "Describe the problem this product solves...", "required": true, "aiSettings": {"enabled": true, "customPrompt": "Generate a clear, concise problem statement for a product."}}');
  perform insert_field_config(default_template_id, 1, 'target_users', 'array', 2, '{"label": "Target Users", "helpText": "Identify the primary user segments who will benefit from your product.", "required": true, "aiSettings": {"enabled": true, "customPrompt": "Based on this problem statement, suggest target user segments."}}');
  perform insert_field_config(default_template_id, 1, 'why_now', 'textarea', 3, '{"label": "Why Now", "helpText": "Explain the market timing and why this is the right moment for this product.", "placeholder": "Why is now the right time for this product?"}');
  perform insert_field_config(default_template_id, 1, 'value_hypothesis', 'textarea', 4, '{"label": "Value Hypothesis", "helpText": "Describe the core value proposition and how it creates value for users.", "placeholder": "What value does this product create?"}');
  perform insert_field_config(default_template_id, 1, 'constraints', 'array', 5, '{"label": "Constraints", "helpText": "List any constraints (budget, time, tech, legal, etc.)"}');
  perform insert_field_config(default_template_id, 1, 'risks', 'array', 6, '{"label": "Risks", "helpText": "Identify potential risks and challenges."}');
  perform insert_field_config(default_template_id, 1, 'assumptions', 'array', 7, '{"label": "Assumptions", "helpText": "List key assumptions that need to be validated."}');
  perform insert_field_config(default_template_id, 1, 'initial_features', 'array', 8, '{"label": "Initial Features", "helpText": "High-level feature list (bullet points)."}');
  perform insert_field_config(default_template_id, 1, 'feasibility_notes', 'textarea', 9, '{"label": "Feasibility Notes", "helpText": "Very rough technical feasibility notes.", "placeholder": "Technical feasibility considerations..."}');
  perform insert_field_config(default_template_id, 1, 'high_level_timeline', 'textarea', 10, '{"label": "High Level Timeline", "helpText": "Very rough timeline expectations.", "placeholder": "Timeline expectations..."}');
  perform insert_field_config(default_template_id, 1, 'master_prompt', 'textarea', 11, '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}');

  raise notice 'Default template created/updated successfully with ID: %', default_template_id;
end $$;

