-- Project Management & Task System - Database Schema
-- Run this in your Supabase SQL Editor

-- Create enum types for task status and priority
create type task_status as enum ('todo', 'in_progress', 'done', 'archived');
create type task_priority as enum ('low', 'medium', 'high', 'critical');

-- Project tasks table
create table if not exists project_tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  phase_number integer check (phase_number between 1 and 6),
  title text not null,
  description text,
  status task_status default 'todo' not null,
  priority task_priority default 'medium' not null,
  assignee_id uuid references users(id) on delete set null,
  due_date timestamptz,
  tags text[] default '{}',
  notes text,
  dependencies uuid[] default '{}',
  ai_generated boolean default false not null,
  ai_analysis_id uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Project analyses table
create table if not exists project_analyses (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  analysis_type text check (analysis_type in ('initial', 'update')) default 'initial' not null,
  summary text,
  next_steps text[] default '{}',
  blockers text[] default '{}',
  estimates jsonb default '{}'::jsonb,
  tasks_generated integer default 0,
  created_at timestamptz default now() not null
);

-- Add foreign key for ai_analysis_id in project_tasks
alter table project_tasks 
  add constraint fk_project_tasks_ai_analysis 
  foreign key (ai_analysis_id) references project_analyses(id) on delete set null;

-- Add initiated_at and initiated_by to projects table
alter table projects 
  add column if not exists initiated_at timestamptz,
  add column if not exists initiated_by uuid references users(id) on delete set null;

-- Create indexes for better performance
create index if not exists idx_project_tasks_project_id on project_tasks(project_id);
create index if not exists idx_project_tasks_phase_number on project_tasks(phase_number);
create index if not exists idx_project_tasks_assignee_id on project_tasks(assignee_id);
create index if not exists idx_project_tasks_status on project_tasks(status);
create index if not exists idx_project_tasks_priority on project_tasks(priority);
create index if not exists idx_project_tasks_ai_analysis_id on project_tasks(ai_analysis_id);
create index if not exists idx_project_analyses_project_id on project_analyses(project_id);
create index if not exists idx_projects_initiated_by on projects(initiated_by);

-- Enable Row Level Security (RLS)
alter table project_tasks enable row level security;
alter table project_analyses enable row level security;

-- RLS Policies for project_tasks
-- Users can read tasks for projects they have access to
create policy "Users can read project tasks"
  on project_tasks for select
  using (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
    or project_id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Users can insert tasks for projects they have access to
create policy "Users can insert project tasks"
  on project_tasks for insert
  with check (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
    or project_id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Users can update tasks for projects they have access to
create policy "Users can update project tasks"
  on project_tasks for update
  using (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
    or project_id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Users can delete tasks for projects they have access to
create policy "Users can delete project tasks"
  on project_tasks for delete
  using (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
    or project_id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- RLS Policies for project_analyses
-- Users can read analyses for projects they have access to
create policy "Users can read project analyses"
  on project_analyses for select
  using (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
    or project_id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Users can insert analyses for projects they have access to
create policy "Users can insert project analyses"
  on project_analyses for insert
  with check (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
    or project_id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for project_tasks updated_at
create trigger update_project_tasks_updated_at
  before update on project_tasks
  for each row
  execute function update_updated_at_column();

