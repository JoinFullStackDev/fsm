-- Allow project members to see user data for assignees in their projects
-- This enables collaboration by showing who is assigned to tasks
-- Run this in your Supabase SQL Editor

-- Drop existing policy if it exists
drop policy if exists "Users can see assignees in their projects" on users;

-- Create policy that allows users to see other users who are:
-- 1. Assigned to tasks in projects the user is a member of
-- 2. Members of projects the user is a member of
-- Uses security definer functions to avoid RLS recursion
create or replace function public.can_see_user_as_assignee(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_current_user_id uuid;
  v_has_shared_project boolean;
begin
  -- Get current user's user record id (bypasses RLS due to security definer)
  select id into v_current_user_id
  from public.users
  where auth_id = auth.uid();
  
  if v_current_user_id is null then
    return false;
  end if;
  
  -- Check if the target user is assigned to any tasks in projects the current user is a member of
  select exists (
    select 1
    from public.project_tasks pt
    where pt.assignee_id = p_user_id
    and (
      -- Current user is project owner
      exists (
        select 1 from public.projects p
        where p.id = pt.project_id
        and p.owner_id = v_current_user_id
      )
      -- Or current user is a project member
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = pt.project_id
        and pm.user_id = v_current_user_id
      )
    )
  ) into v_has_shared_project;
  
  if v_has_shared_project then
    return true;
  end if;
  
  -- Also check if both users are members of the same project
  select exists (
    select 1
    from public.project_members pm1
    inner join public.project_members pm2 on pm1.project_id = pm2.project_id
    where pm1.user_id = v_current_user_id
    and pm2.user_id = p_user_id
  ) into v_has_shared_project;
  
  return v_has_shared_project;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.can_see_user_as_assignee(uuid) to authenticated;

-- Create SELECT policy for users table
-- This allows users to see other users who are assignees or members in shared projects
create policy "Users can see assignees in their projects"
  on users for select
  using (
    -- Can always see own record
    auth.uid() = auth_id
    -- Or can see users who are assignees/members in shared projects
    or public.can_see_user_as_assignee(id)
  );

-- Verify the policy was created
select * from pg_policies where tablename = 'users' and policyname = 'Users can see assignees in their projects';

