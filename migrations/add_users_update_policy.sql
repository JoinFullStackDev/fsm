-- Add UPDATE policy for users table
-- This allows users to update their own profile information
-- Run this in your Supabase SQL Editor

-- Drop existing policy if it exists
drop policy if exists "Users can update own user record" on users;

-- Create UPDATE policy
create policy "Users can update own user record"
  on users for update
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

-- Verify the policy was created
select * from pg_policies where tablename = 'users' and policyname = 'Users can update own user record';

