-- Fix RLS policies for activity_logs table
-- Run this in your Supabase SQL Editor

-- Drop existing policies
drop policy if exists "Users can view own activity" on activity_logs;
drop policy if exists "Admins can view all activity" on activity_logs;

-- Recreate policies with correct checks
create policy "Users can view own activity"
  on activity_logs for select
  using (
    user_id in (
      select id from users where auth_id = auth.uid()
    )
  );

create policy "Admins can view all activity"
  on activity_logs for select
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

