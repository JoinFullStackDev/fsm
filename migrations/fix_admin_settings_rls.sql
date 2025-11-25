-- Fix RLS policies for admin_settings table
-- The policies were checking users.id = auth.uid() but should check users.auth_id = auth.uid()
-- Run this in your Supabase SQL Editor

-- Drop existing policies
drop policy if exists "Admins can view all settings" on admin_settings;
drop policy if exists "Admins can insert settings" on admin_settings;
drop policy if exists "Admins can update settings" on admin_settings;
drop policy if exists "Admins can delete settings" on admin_settings;

-- Recreate policies with correct auth_id check
create policy "Admins can view all settings"
  on admin_settings for select
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

create policy "Admins can insert settings"
  on admin_settings for insert
  with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

create policy "Admins can update settings"
  on admin_settings for update
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

create policy "Admins can delete settings"
  on admin_settings for delete
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

