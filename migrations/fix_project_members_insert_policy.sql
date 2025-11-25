-- Fix project_members INSERT policy to work with updated RLS
-- This ensures project owners and admins can add members without RLS blocking
-- Run this in your Supabase SQL Editor

-- Drop existing INSERT policies if they exist
drop policy if exists "Project owners can add members" on project_members;
drop policy if exists "Project members can add themselves" on project_members;
drop policy if exists "Admins can add project members" on project_members;

-- Create or replace the security definer function to check project ownership
-- This bypasses RLS and breaks the recursion cycle
create or replace function public.is_project_owner(p_project_id uuid)
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
  -- Get current user's user record id (bypasses RLS due to security definer)
  select id into v_user_id
  from public.users
  where auth_id = auth.uid();
  
  if v_user_id is null then
    return false;
  end if;
  
  -- Get project owner_id (bypasses RLS due to security definer)
  select owner_id into v_owner_id
  from public.projects
  where id = p_project_id;
  
  if v_owner_id is null then
    return false;
  end if;
  
  -- Check if current user is the owner
  return v_owner_id = v_user_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.is_project_owner(uuid) to authenticated;

-- Create INSERT policy for project owners using the function (avoids recursion and RLS issues)
create policy "Project owners can add members"
  on project_members for insert
  with check (public.is_project_owner(project_id));

-- Create INSERT policy for admins (using the is_admin function from add_admin_users_rls_policy.sql)
create policy "Admins can add project members"
  on project_members for insert
  with check (public.is_admin());

-- Verify the policies were created
select * from pg_policies where tablename = 'project_members' and cmd = 'INSERT';

