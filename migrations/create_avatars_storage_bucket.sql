-- Create avatars storage bucket and policies
-- Run this in your Supabase SQL Editor

-- Create the avatars bucket (if it doesn't exist)
-- Note: This needs to be done via Supabase Dashboard or API, but we'll create the policies here
-- Go to Storage > Create Bucket > Name: "avatars" > Public: true

-- Storage policies for avatars bucket
-- These policies control who can upload, read, and delete avatar images

-- Policy: Anyone can view avatars (public bucket)
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatar
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Alternative: Allow any authenticated user to upload to avatars folder
-- This is simpler but less secure - users could overwrite others' avatars
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

-- Policy: Users can update their own avatar
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own avatar
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Note: The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage
-- 2. Click "New bucket"
-- 3. Name: "avatars"
-- 4. Public bucket: Yes (so avatars are publicly accessible)
-- 5. File size limit: 5MB (recommended)
-- 6. Allowed MIME types: image/* (optional but recommended)

