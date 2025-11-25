-- Make Phases Dynamic - Database Schema Migration
-- This migration enables full flexibility for phase management:
-- - Add/remove phases
-- - Rename phases
-- - Reorder phases
-- - Maintains backward compatibility with existing data

-- Step 1: Add phase metadata columns to template_phases
alter table template_phases
  add column if not exists phase_name text,
  add column if not exists display_order int,
  add column if not exists is_active boolean default true;

-- Step 2: Add phase metadata columns to project_phases
alter table project_phases
  add column if not exists phase_name text,
  add column if not exists display_order int,
  add column if not exists is_active boolean default true;

-- Step 3: Migrate existing data - Set default values for existing records
-- Default phase names based on FullStack Method standard phases
update template_phases
set 
  phase_name = case phase_number
    when 1 then 'Concept Framing'
    when 2 then 'Product Strategy'
    when 3 then 'Rapid Prototype Definition'
    when 4 then 'Analysis & User Stories'
    when 5 then 'Build Accelerator'
    when 6 then 'QA & Hardening'
    else 'Phase ' || phase_number::text
  end,
  display_order = phase_number,
  is_active = true
where phase_name is null;

update project_phases
set 
  phase_name = case phase_number
    when 1 then 'Concept Framing'
    when 2 then 'Product Strategy'
    when 3 then 'Rapid Prototype Definition'
    when 4 then 'Analysis & User Stories'
    when 5 then 'Build Accelerator'
    when 6 then 'QA & Hardening'
    else 'Phase ' || phase_number::text
  end,
  display_order = phase_number,
  is_active = true
where phase_name is null;

-- Step 4: Remove the hardcoded phase_number constraint (1-6)
-- We'll allow any positive integer for phase_number
-- First, drop the existing check constraints
alter table template_phases
  drop constraint if exists template_phases_phase_number_check;

alter table project_phases
  drop constraint if exists project_phases_phase_number_check;

alter table template_field_configs
  drop constraint if exists template_field_configs_phase_number_check;

alter table template_field_groups
  drop constraint if exists template_field_groups_phase_number_check;

-- Step 5: Add new constraint allowing any positive integer
alter table template_phases
  add constraint template_phases_phase_number_positive 
  check (phase_number > 0);

alter table project_phases
  add constraint project_phases_phase_number_positive 
  check (phase_number > 0);

alter table template_field_configs
  add constraint template_field_configs_phase_number_positive 
  check (phase_number > 0);

alter table template_field_groups
  add constraint template_field_groups_phase_number_positive 
  check (phase_number > 0);

-- Step 6: Make phase_name required (not null) after setting defaults
alter table template_phases
  alter column phase_name set not null,
  alter column display_order set not null,
  alter column is_active set not null,
  alter column is_active set default true;

alter table project_phases
  alter column phase_name set not null,
  alter column display_order set not null,
  alter column is_active set not null,
  alter column is_active set default true;

-- Step 7: Add indexes for better performance
create index if not exists idx_template_phases_display_order 
  on template_phases(template_id, display_order);

create index if not exists idx_project_phases_display_order 
  on project_phases(project_id, display_order);

create index if not exists idx_template_phases_active 
  on template_phases(template_id, is_active) 
  where is_active = true;

create index if not exists idx_project_phases_active 
  on project_phases(project_id, is_active) 
  where is_active = true;

-- Step 8: Add comments for documentation
comment on column template_phases.phase_name is 'Human-readable name for the phase (e.g., "Concept Framing")';
comment on column template_phases.display_order is 'Order in which phases should be displayed (1 = first)';
comment on column template_phases.is_active is 'Whether this phase is active. Inactive phases are hidden but not deleted.';

comment on column project_phases.phase_name is 'Human-readable name for the phase (e.g., "Concept Framing")';
comment on column project_phases.display_order is 'Order in which phases should be displayed (1 = first)';
comment on column project_phases.is_active is 'Whether this phase is active. Inactive phases are hidden but not deleted.';

