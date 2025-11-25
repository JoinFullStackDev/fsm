-- Fix infinite recursion in project_members INSERT policy
-- Run this in your Supabase SQL Editor

-- Drop the problematic INSERT policy
drop policy if exists "Project owners can add members" on project_members;
drop policy if exists "Project members can add themselves" on project_members;

-- Create a security definer function to check project ownership
-- This bypasses RLS and breaks the recursion cycle
create or replace function is_project_owner(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner_id uuid;
  v_user_id uuid;
begin
  -- Get current user's user record id
  select id into v_user_id
  from users
  where auth_id = auth.uid();
  
  if v_user_id is null then
    return false;
  end if;
  
  -- Get project owner_id (bypasses RLS due to security definer)
  select owner_id into v_owner_id
  from projects
  where id = p_project_id;
  
  -- Check if current user is the owner
  return v_owner_id = v_user_id;
end;
$$;

-- Create INSERT policy using the function (avoids recursion)
create policy "Project owners can add members"
  on project_members for insert
  with check (is_project_owner(project_id));

-- Grant execute permission to authenticated users
grant execute on function is_project_owner(uuid) to authenticated;

