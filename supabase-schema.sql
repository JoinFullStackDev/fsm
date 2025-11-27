-- FullStack Method™ App - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid not null,
  email text not null unique,
  name text,
  role text check (role in ('admin', 'pm', 'designer', 'engineer')) default 'pm',
  created_at timestamptz default now()
);

-- Projects table
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references users(id),
  name text not null,
  description text,
  status text check (status in ('idea', 'in_progress', 'blueprint_ready', 'archived')) default 'idea',
  primary_tool text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Project members table
create table if not exists project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text check (role in ('admin', 'pm', 'designer', 'engineer')) default 'pm',
  created_at timestamptz default now()
);

-- Project phases table
create table if not exists project_phases (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  phase_number int check (phase_number between 1 and 6),
  data jsonb default '{}'::jsonb,
  completed boolean default false,
  updated_at timestamptz default now(),
  unique (project_id, phase_number)
);

-- Exports table
create table if not exists exports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  export_type text,
  storage_path text,
  created_at timestamptz default now()
);

-- Create indexes for better performance
create index if not exists idx_projects_owner_id on projects(owner_id);
create index if not exists idx_project_members_project_id on project_members(project_id);
create index if not exists idx_project_members_user_id on project_members(user_id);
create index if not exists idx_project_phases_project_id on project_phases(project_id);
create index if not exists idx_exports_project_id on exports(project_id);

-- Enable Row Level Security (RLS)
alter table users enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_phases enable row level security;
alter table exports enable row level security;

-- RLS Policies (basic - adjust based on your security needs)
-- Users can read their own user record
create policy "Users can read own user record"
  on users for select
  using (auth.uid() = auth_id);

-- Users can insert their own user record (for signup)
create policy "Users can insert own user record"
  on users for insert
  with check (auth.uid() = auth_id);

-- Users can read projects they own
create policy "Users can read own projects"
  on projects for select
  using (
    owner_id in (select id from users where auth_id = auth.uid())
  );

-- Users can read projects they are members of (separate policy to avoid recursion)
create policy "Users can read projects they are members of"
  on projects for select
  using (
    id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Users can create projects
create policy "Users can create projects"
  on projects for insert
  with check (owner_id in (select id from users where auth_id = auth.uid()));

-- Users can update projects they own
create policy "Users can update own projects"
  on projects for update
  using (owner_id in (select id from users where auth_id = auth.uid()));

-- Users can delete projects they own
create policy "Users can delete own projects"
  on projects for delete
  using (owner_id in (select id from users where auth_id = auth.uid()));

-- Project members policies
-- Check user_id directly only to avoid recursion with projects table
create policy "Users can read project members"
  on project_members for select
  using (
    user_id in (select id from users where auth_id = auth.uid())
  );

-- Allow project owners to add members
create policy "Project owners can add members"
  on project_members for insert
  with check (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Project phases policies
create policy "Users can read project phases"
  on project_phases for select
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

create policy "Users can insert project phases"
  on project_phases for insert
  with check (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
  );

create policy "Users can update project phases"
  on project_phases for update
  using (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Exports policies
create policy "Users can read exports"
  on exports for select
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

create policy "Users can create exports"
  on exports for insert
  with check (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Note: You may want to refine these policies based on your specific security requirements

