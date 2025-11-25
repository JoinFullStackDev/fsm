-- Add RLS policies to allow admins to read, update, and delete all users
-- Run this in your Supabase SQL Editor
-- This uses a SECURITY DEFINER function to avoid circular RLS dependencies

-- First, create a function to check if current user is admin (bypasses RLS)
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.users
    where auth_id = auth.uid()
    and role = 'admin'
  );
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.is_admin() to authenticated;

-- Drop existing admin policies if they exist
drop policy if exists "Admins can read all users" on users;
drop policy if exists "Admins can update all users" on users;
drop policy if exists "Admins can delete all users" on users;

-- Allow admins to read all users (using the function to avoid circular dependency)
create policy "Admins can read all users"
  on users for select
  using (public.is_admin());

-- Allow admins to update all users
create policy "Admins can update all users"
  on users for update
  using (public.is_admin())
  with check (public.is_admin());

-- Allow admins to delete all users
create policy "Admins can delete all users"
  on users for delete
  using (public.is_admin());

-- Verify the policies were created
select * from pg_policies where tablename = 'users' and policyname like '%admin%';

