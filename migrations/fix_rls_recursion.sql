-- Fix infinite recursion in RLS policies

-- Drop the problematic policies
drop policy if exists "Users can read project members" on project_members;
drop policy if exists "Users can read project phases" on project_phases;
drop policy if exists "Users can read exports" on exports;
drop policy if exists "Users can read own projects" on projects;

-- Fix project_members policy - check user_id directly to avoid recursion
create policy "Users can read project members"
  on project_members for select
  using (
    user_id in (select id from users where auth_id = auth.uid())
    or project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Allow users to insert themselves as project members (for project owners)
create policy "Project owners can add members"
  on project_members for insert
  with check (
    project_id in (
      select id from projects 
      where owner_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Fix projects policy - remove the recursive project_members check
create policy "Users can read own projects"
  on projects for select
  using (
    owner_id in (select id from users where auth_id = auth.uid())
  );

-- Add a separate policy for reading projects where user is a member
-- This uses a simpler check that doesn't recurse
create policy "Users can read projects they are members of"
  on projects for select
  using (
    id in (
      select project_id from project_members 
      where user_id in (select id from users where auth_id = auth.uid())
    )
  );

-- Fix project_phases policy
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

-- Fix exports policy
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
