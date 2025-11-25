-- First, drop the existing policy if it exists
drop policy if exists "Users can insert own user record" on users;

-- Create the INSERT policy with proper check
create policy "Users can insert own user record"
  on users for insert
  with check (auth.uid() = auth_id);

-- Alternative: If the above doesn't work, try this more permissive policy for signup
-- (Only use this if the above doesn't work)
-- create policy "Allow authenticated users to insert during signup"
--   on users for insert
--   with check (auth.uid() is not null and auth.uid() = auth_id);

-- Verify the policy was created
select * from pg_policies where tablename = 'users';
