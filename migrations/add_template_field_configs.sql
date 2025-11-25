-- Add template_field_configs table for storing field configurations in templates
-- Run this in your Supabase SQL Editor

-- Template field configurations table
create table if not exists template_field_configs (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references project_templates(id) on delete cascade,
  phase_number int check (phase_number between 1 and 6),
  field_key text not null,
  field_type text not null check (field_type in ('text', 'textarea', 'array', 'object', 'select', 'checkbox', 'slider', 'date', 'file', 'table', 'custom')),
  display_order int not null default 0,
  layout_config jsonb default '{}'::jsonb,
  field_config jsonb default '{}'::jsonb,
  conditional_logic jsonb,
  group_id text,
  created_at timestamptz default now(),
  unique (template_id, phase_number, field_key)
);

-- Template field groups table
create table if not exists template_field_groups (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references project_templates(id) on delete cascade,
  phase_number int check (phase_number between 1 and 6),
  group_key text not null,
  label text not null,
  description text,
  icon text,
  collapsible boolean default true,
  default_collapsed boolean default false,
  display_order int not null default 0,
  created_at timestamptz default now(),
  unique (template_id, phase_number, group_key)
);

-- Add version field to project_templates for versioning
alter table project_templates add column if not exists version text default '1.0.0';

-- Create indexes
create index if not exists idx_template_field_configs_template_id on template_field_configs(template_id);
create index if not exists idx_template_field_configs_phase on template_field_configs(template_id, phase_number);
create index if not exists idx_template_field_configs_order on template_field_configs(template_id, phase_number, display_order);
create index if not exists idx_template_field_groups_template_id on template_field_groups(template_id);
create index if not exists idx_template_field_groups_phase on template_field_groups(template_id, phase_number);

-- RLS Policies for template_field_configs
alter table template_field_configs enable row level security;

-- Users can view field configs of templates they can view
create policy "Users can view template field configs for accessible templates"
  on template_field_configs for select
  using (
    exists (
      select 1 from project_templates
      where project_templates.id = template_field_configs.template_id
      and (
        project_templates.is_public = true
        or project_templates.created_by = (select id from users where auth_id = auth.uid())
        or exists (
          select 1 from users
          where users.auth_id = auth.uid()
          and users.role = 'admin'
        )
      )
    )
  );

-- Only admins can manage template field configs
create policy "Only admins can manage template field configs"
  on template_field_configs for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- RLS Policies for template_field_groups
alter table template_field_groups enable row level security;

-- Users can view field groups of templates they can view
create policy "Users can view template field groups for accessible templates"
  on template_field_groups for select
  using (
    exists (
      select 1 from project_templates
      where project_templates.id = template_field_groups.template_id
      and (
        project_templates.is_public = true
        or project_templates.created_by = (select id from users where auth_id = auth.uid())
        or exists (
          select 1 from users
          where users.auth_id = auth.uid()
          and users.role = 'admin'
        )
      )
    )
  );

-- Only admins can manage template field groups
create policy "Only admins can manage template field groups"
  on template_field_groups for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- Note: After running this migration, run create_default_template.sql
-- to populate the default template with all field configurations based on
-- the current FullStack Method phase structure.
--
-- Alternatively, you can use the API endpoint:
-- POST /api/admin/templates/generate-default
-- Or run the script: npx tsx scripts/populate-default-template.ts

