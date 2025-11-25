-- Create a function to handle user creation during signup
-- This function runs with SECURITY DEFINER to bypass RLS
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'pm')::text
  );
  return new;
end;
$$;

-- Create a trigger that automatically creates a user record when someone signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also ensure the INSERT policy exists (as a backup)
drop policy if exists "Users can insert own user record" on users;
create policy "Users can insert own user record"
  on users for insert
  with check (auth.uid() = auth_id);
