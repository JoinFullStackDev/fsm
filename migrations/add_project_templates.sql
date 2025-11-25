-- Add project_templates table for reusable project templates
-- Run this in your Supabase SQL Editor

-- Project templates table
create table if not exists project_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid references users(id),
  is_public boolean default false,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Template phases table (stores pre-filled phase data for templates)
create table if not exists template_phases (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references project_templates(id) on delete cascade,
  phase_number int check (phase_number between 1 and 6),
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (template_id, phase_number)
);

-- Create indexes
create index if not exists idx_project_templates_created_by on project_templates(created_by);
create index if not exists idx_project_templates_public on project_templates(is_public);
create index if not exists idx_template_phases_template_id on template_phases(template_id);

-- RLS Policies for project_templates
alter table project_templates enable row level security;

-- Anyone can view public templates
create policy "Public templates are viewable by everyone"
  on project_templates for select
  using (is_public = true);

-- Users can view their own templates
create policy "Users can view their own templates"
  on project_templates for select
  using (created_by = (select id from users where auth_id = auth.uid()));

-- Admins can view all templates
create policy "Admins can view all templates"
  on project_templates for select
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- Only admins can create templates
create policy "Only admins can create templates"
  on project_templates for insert
  with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- Only admins can update templates
create policy "Only admins can update templates"
  on project_templates for update
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- Only admins can delete templates
create policy "Only admins can delete templates"
  on project_templates for delete
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- RLS Policies for template_phases
alter table template_phases enable row level security;

-- Users can view phases of templates they can view
create policy "Users can view template phases for accessible templates"
  on template_phases for select
  using (
    exists (
      select 1 from project_templates
      where project_templates.id = template_phases.template_id
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

-- Only admins can manage template phases
create policy "Only admins can manage template phases"
  on template_phases for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

