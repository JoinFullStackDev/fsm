-- Add template_id column to projects table
-- This allows projects to have a specific template assigned

alter table projects add column if not exists template_id uuid references project_templates(id) on delete set null;

-- Create index for faster lookups
create index if not exists idx_projects_template_id on projects(template_id);

-- Add comment
comment on column projects.template_id is 'The template used for this project. If null, the default template will be used.';

