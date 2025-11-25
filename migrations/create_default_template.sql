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

  -- Phase 1 Field Configurations
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'problem_statement', 'textarea', 1,
   '{"columns": 12}'::jsonb,
   '{"label": "Problem Statement", "helpText": "Clearly define the problem your product solves. Be specific about pain points, who experiences them, and why existing solutions fall short.", "placeholder": "Describe the problem this product solves...", "required": true, "aiSettings": {"enabled": true, "customPrompt": "Generate a clear, concise problem statement for a product."}}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'problem_statement'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'target_users', 'array', 2,
   '{"columns": 12}'::jsonb,
   '{"label": "Target Users", "helpText": "Identify the primary user segments who will benefit from your product.", "required": true, "aiSettings": {"enabled": true, "customPrompt": "Based on this problem statement, suggest target user segments."}}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'target_users'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'why_now', 'textarea', 3,
   '{"columns": 12}'::jsonb,
   '{"label": "Why Now", "helpText": "Explain the market timing and why this is the right moment for this product.", "placeholder": "Why is now the right time for this product?"}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'why_now'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'value_hypothesis', 'textarea', 4,
   '{"columns": 12}'::jsonb,
   '{"label": "Value Hypothesis", "helpText": "Describe the core value proposition and how it creates value for users.", "placeholder": "What value does this product create?"}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'value_hypothesis'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'constraints', 'array', 5,
   '{"columns": 12}'::jsonb,
   '{"label": "Constraints", "helpText": "List any constraints (budget, time, tech, legal, etc.)"}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'constraints'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'risks', 'array', 6,
   '{"columns": 12}'::jsonb,
   '{"label": "Risks", "helpText": "Identify potential risks and challenges."}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'risks'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'assumptions', 'array', 7,
   '{"columns": 12}'::jsonb,
   '{"label": "Assumptions", "helpText": "List key assumptions that need to be validated."}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'assumptions'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'initial_features', 'array', 8,
   '{"columns": 12}'::jsonb,
   '{"label": "Initial Features", "helpText": "High-level feature list (bullet points)."}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'initial_features'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'feasibility_notes', 'textarea', 9,
   '{"columns": 12}'::jsonb,
   '{"label": "Feasibility Notes", "helpText": "Very rough technical feasibility notes.", "placeholder": "Technical feasibility considerations..."}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'feasibility_notes'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'high_level_timeline', 'textarea', 10,
   '{"columns": 12}'::jsonb,
   '{"label": "High Level Timeline", "helpText": "Very rough timeline expectations.", "placeholder": "Timeline expectations..."}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'high_level_timeline'
  );
  
  insert into template_field_configs (
    id, template_id, phase_number, field_key, field_type, display_order,
    layout_config, field_config
  )
  select uuid_generate_v4(), default_template_id, 1, 'master_prompt', 'textarea', 11,
   '{"columns": 12}'::jsonb,
   '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}'::jsonb
  where not exists (
    select 1 from template_field_configs
    where template_id = default_template_id
    and phase_number = 1
    and field_key = 'master_prompt'
  );

  -- Phase 2 Field Configurations
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'personas', 'custom', 1, '{"columns": 12}'::jsonb, '{"label": "Personas", "helpText": "Define user personas with name, description, goals, and pains.", "aiSettings": {"enabled": true, "customPrompt": "Generate user personas based on target users and problem statement."}}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'personas');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'jtbd', 'custom', 2, '{"columns": 12}'::jsonb, '{"label": "Jobs To Be Done", "helpText": "Define JTBD statements linking personas to outcomes."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'jtbd');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'business_outcomes', 'array', 3, '{"columns": 12}'::jsonb, '{"label": "Business Outcomes", "helpText": "List desired business outcomes."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'business_outcomes');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'kpis', 'array', 4, '{"columns": 12}'::jsonb, '{"label": "KPIs", "helpText": "Key performance indicators to measure success."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'kpis');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'features', 'custom', 5, '{"columns": 12}'::jsonb, '{"label": "Features", "helpText": "Feature ideas with title, description, target persona, and outcome."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'features');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'scored_features', 'custom', 6, '{"columns": 12}'::jsonb, '{"label": "Scored Features", "helpText": "Features with impact/effort/confidence scoring and MVP grouping."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'scored_features');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'tech_stack_preferences', 'textarea', 7, '{"columns": 12}'::jsonb, '{"label": "Tech Stack Preferences", "helpText": "Preferred technologies and constraints (e.g., \"React + Supabase\", \"must be HIPAA-friendly\").", "placeholder": "Tech stack preferences and constraints..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'tech_stack_preferences');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 2, 'master_prompt', 'textarea', 8, '{"columns": 12}'::jsonb, '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 2 and field_key = 'master_prompt');

  -- Phase 3 Field Configurations
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 3, 'screens', 'custom', 1, '{"columns": 12}'::jsonb, '{"label": "Screens", "helpText": "Define screens with key, title, description, roles, and core flag."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 3 and field_key = 'screens');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 3, 'flows', 'custom', 2, '{"columns": 12}'::jsonb, '{"label": "User Flows", "helpText": "Define user flows with name, start/end screens, steps, and notes."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 3 and field_key = 'flows');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 3, 'components', 'custom', 3, '{"columns": 12}'::jsonb, '{"label": "Components", "helpText": "Define components with name, description, props, state behavior, and usage."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 3 and field_key = 'components');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 3, 'design_tokens', 'custom', 4, '{"columns": 12}'::jsonb, '{"label": "Design Tokens", "helpText": "Color tokens, typography scale, and spacing notes."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 3 and field_key = 'design_tokens');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 3, 'navigation', 'custom', 5, '{"columns": 12}'::jsonb, '{"label": "Navigation", "helpText": "Primary nav, secondary nav, and route map."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 3 and field_key = 'navigation');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 3, 'master_prompt', 'textarea', 6, '{"columns": 12}'::jsonb, '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 3 and field_key = 'master_prompt');

  -- Phase 4 Field Configurations
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'entities', 'custom', 1, '{"columns": 12}'::jsonb, '{"label": "Entities & Data Models", "helpText": "Define entities with name, description, key fields, and relationships."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'entities');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'erd', 'custom', 2, '{"columns": 12}'::jsonb, '{"label": "ERD Structure", "helpText": "Entity-relationship diagram structure (text/JSON)."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'erd');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'api_spec', 'custom', 3, '{"columns": 12}'::jsonb, '{"label": "API Specifications", "helpText": "API endpoints with method, path, description, schemas, and error codes."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'api_spec');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'user_stories', 'custom', 4, '{"columns": 12}'::jsonb, '{"label": "User Stories", "helpText": "User stories with role and \"As a... I want... so that...\" statements."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'user_stories');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'acceptance_criteria', 'custom', 5, '{"columns": 12}'::jsonb, '{"label": "Acceptance Criteria", "helpText": "Acceptance criteria per story in Given/When/Then format."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'acceptance_criteria');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'rbac', 'custom', 6, '{"columns": 12}'::jsonb, '{"label": "RBAC Matrix", "helpText": "Roles x actions matrix (view/create/edit/delete per entity)."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'rbac');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'non_functional_requirements', 'textarea', 7, '{"columns": 12}'::jsonb, '{"label": "Non-Functional Requirements", "helpText": "Security, performance, compliance, logging, auditability requirements.", "placeholder": "Non-functional requirements..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'non_functional_requirements');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 4, 'master_prompt', 'textarea', 8, '{"columns": 12}'::jsonb, '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 4 and field_key = 'master_prompt');

  -- Phase 5 Field Configurations
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 5, 'folder_structure', 'textarea', 1, '{"columns": 12}'::jsonb, '{"label": "Folder Structure", "helpText": "Preferred folder structure definition (frontend/backend/shared).", "placeholder": "Define folder structure..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 5 and field_key = 'folder_structure');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 5, 'architecture_instructions', 'textarea', 2, '{"columns": 12}'::jsonb, '{"label": "Architecture Instructions", "helpText": "Preferred architecture pattern (e.g., Next.js App Router, file-based routing).", "placeholder": "Architecture instructions..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 5 and field_key = 'architecture_instructions');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 5, 'coding_standards', 'textarea', 3, '{"columns": 12}'::jsonb, '{"label": "Coding Standards & Patterns", "helpText": "TypeScript, hooks, separation of concerns guidelines.", "placeholder": "Coding standards..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 5 and field_key = 'coding_standards');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 5, 'env_setup', 'textarea', 4, '{"columns": 12}'::jsonb, '{"label": "Environment & Config Notes", "helpText": "Env vars required, basic secrets (described, not actual secrets).", "placeholder": "Environment setup notes..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 5 and field_key = 'env_setup');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 5, 'master_prompt', 'textarea', 5, '{"columns": 12}'::jsonb, '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 5 and field_key = 'master_prompt');

  -- Phase 6 Field Configurations
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 6, 'test_plan', 'textarea', 1, '{"columns": 12}'::jsonb, '{"label": "Test Strategy", "helpText": "Test strategy (unit, integration, e2e).", "placeholder": "Test strategy..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 6 and field_key = 'test_plan');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 6, 'test_cases', 'custom', 2, '{"columns": 12}'::jsonb, '{"label": "Test Cases", "helpText": "Core test cases (at least for key flows)."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 6 and field_key = 'test_cases');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 6, 'security_checklist', 'array', 3, '{"columns": 12}'::jsonb, '{"label": "Security & Hardening Checklist", "helpText": "Security and hardening checklist items."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 6 and field_key = 'security_checklist');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 6, 'performance_requirements', 'textarea', 4, '{"columns": 12}'::jsonb, '{"label": "Performance Expectations", "helpText": "Performance expectations (e.g., response times).", "placeholder": "Performance requirements..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 6 and field_key = 'performance_requirements');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 6, 'launch_readiness', 'array', 5, '{"columns": 12}'::jsonb, '{"label": "Launch Readiness Checklist", "helpText": "Launch readiness checklist items."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 6 and field_key = 'launch_readiness');
  
  insert into template_field_configs (id, template_id, phase_number, field_key, field_type, display_order, layout_config, field_config)
  select uuid_generate_v4(), default_template_id, 6, 'master_prompt', 'textarea', 6, '{"columns": 12}'::jsonb, '{"label": "Master Prompt", "helpText": "Custom prompt for AI document generation. Use {{phase_data}} as placeholder.", "placeholder": "Enter custom prompt for document generation..."}'::jsonb
  where not exists (select 1 from template_field_configs where template_id = default_template_id and phase_number = 6 and field_key = 'master_prompt');

  raise notice 'Default template created/updated successfully with ID: %', default_template_id;
end $$;

