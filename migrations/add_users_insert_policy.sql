-- Add INSERT policy for users table to allow signup
create policy "Users can insert own user record"
  on users for insert
  with check (auth.uid() = auth_id);
