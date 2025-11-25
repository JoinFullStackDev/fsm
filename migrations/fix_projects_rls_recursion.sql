-- Fix Infinite Recursion in Projects RLS Policy
-- Run this in your Supabase SQL Editor

-- Drop the recursive policy
drop policy if exists "Users can read project members" on project_members;

-- Create simplified policy (no projects table query)
-- This breaks the cycle: projects can query project_members, but project_members doesn't query projects
create policy "Users can read project members"
  on project_members for select
  using (
    user_id in (select id from users where auth_id = auth.uid())
  );
