-- Update create_user_record function to handle conflicts properly
-- This prevents duplicate user records when a user signs in after being created by admin
-- Run this in your Supabase SQL Editor

drop function if exists public.create_user_record(uuid, text, text, text);

create or replace function public.create_user_record(
  p_auth_id uuid,
  p_email text,
  p_name text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if user already exists by auth_id or email
  if not exists (
    select 1 from public.users 
    where auth_id = p_auth_id or email = p_email
  ) then
    insert into public.users (auth_id, email, name, role)
    values (p_auth_id, p_email, p_name, p_role);
  end if;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.create_user_record(uuid, text, text, text) to authenticated;

