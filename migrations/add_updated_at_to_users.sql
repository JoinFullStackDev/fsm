-- Add updated_at column to users table
-- Run this in your Supabase SQL Editor

alter table users 
  add column if not exists updated_at timestamptz default now();

-- Create index for better query performance
create index if not exists idx_users_updated_at on users(updated_at);

-- Add comment for documentation
comment on column users.updated_at is 'Timestamp of when the user record was last updated';

-- Create a trigger to automatically update updated_at on row updates
create or replace function update_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_users_updated_at_trigger on users;
create trigger update_users_updated_at_trigger
  before update on users
  for each row
  execute function update_users_updated_at();

