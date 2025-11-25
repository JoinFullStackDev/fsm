-- Enhance users table with additional profile fields
-- Run this in your Supabase SQL Editor

-- Add new columns to users table
alter table users
  add column if not exists bio text,
  add column if not exists company text,
  add column if not exists title text,
  add column if not exists location text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists avatar_url text,
  add column if not exists github_username text,
  add column if not exists github_access_token text, -- Will be encrypted
  add column if not exists preferences jsonb default '{}'::jsonb,
  add column if not exists is_active boolean default true,
  add column if not exists last_active_at timestamptz;

-- Create indexes for better query performance
create index if not exists idx_users_is_active on users(is_active);
create index if not exists idx_users_last_active_at on users(last_active_at);
create index if not exists idx_users_github_username on users(github_username) where github_username is not null;

-- Add comment for documentation
comment on column users.preferences is 'User preferences stored as JSON: notifications, theme, AI settings';
comment on column users.github_access_token is 'Encrypted GitHub OAuth token';

