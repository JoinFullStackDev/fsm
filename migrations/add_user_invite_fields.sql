-- Add fields to track admin-invited users
-- Run this in your Supabase SQL Editor

-- Add columns to track invited users
alter table users
  add column if not exists invited_by_admin boolean default false,
  add column if not exists invite_created_at timestamptz,
  add column if not exists invite_created_by uuid references users(id) on delete set null;

-- Create index for filtering invited users
create index if not exists idx_users_invited_by_admin on users(invited_by_admin) where invited_by_admin = true;

-- Add comment for documentation
comment on column users.invited_by_admin is 'True if user was created by admin and has not logged in yet';
comment on column users.invite_created_at is 'When the user was invited by admin';
comment on column users.invite_created_by is 'Admin user who created this invite';

