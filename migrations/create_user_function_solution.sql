-- Solution: Create a function that can be called from the client
-- This function runs with SECURITY DEFINER to bypass RLS

-- First, drop existing function if it exists
drop function if exists public.create_user_record(uuid, text, text, text);

-- Create the function
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
  insert into public.users (auth_id, email, name, role)
  values (p_auth_id, p_email, p_name, p_role)
  on conflict (email) do nothing;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.create_user_record(uuid, text, text, text) to authenticated;

-- Also ensure the INSERT policy exists as backup
drop policy if exists "Users can insert own user record" on users;
create policy "Users can insert own user record"
  on users for insert
  with check (auth.uid() = auth_id);
