-- Fix project_members SELECT policy to allow project members to see all members
-- Run this in your Supabase SQL Editor

-- Drop existing SELECT policy
drop policy if exists "Users can read project members" on project_members;

-- Create new SELECT policy that allows:
-- 1. Users to see members of projects they belong to
-- 2. Project owners to see all members
-- Uses a security definer function to avoid RLS recursion
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid;
  v_is_owner boolean;
  v_is_member boolean;
begin
  -- Get current user's user record id (bypasses RLS due to security definer)
  select id into v_user_id
  from public.users
  where auth_id = auth.uid();
  
  if v_user_id is null then
    return false;
  end if;
  
  -- Check if user is project owner (bypasses RLS)
  select exists (
    select 1 from public.projects
    where id = p_project_id
    and owner_id = v_user_id
  ) into v_is_owner;
  
  -- Check if user is a project member (bypasses RLS)
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
    and user_id = v_user_id
  ) into v_is_member;
  
  return v_is_owner or v_is_member;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.is_project_member(uuid) to authenticated;

-- Create SELECT policy using the function
create policy "Users can read project members"
  on project_members for select
  using (public.is_project_member(project_id));

-- Verify the policy was created
select * from pg_policies where tablename = 'project_members' and cmd = 'SELECT';

