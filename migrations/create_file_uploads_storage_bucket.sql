-- Create file_uploads storage bucket and policies
-- Run this in your Supabase SQL Editor

-- Create the file_uploads bucket (if it doesn't exist)
-- Note: This needs to be done via Supabase Dashboard or API, but we'll create the policies here
-- Go to Storage > Create Bucket > Name: "file_uploads" > Public: false (or true, depending on requirements)

-- Storage policies for file_uploads bucket
-- These policies control who can upload, read, and delete files

-- Policy: Authenticated users can view files (adjust based on requirements)
-- Option 1: Public read access (if files should be publicly accessible)
create policy "File uploads are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'file_uploads');

-- Option 2: Users can only view their own files (more secure)
-- Uncomment this and comment out the above if you want private files
-- create policy "Users can view their own file uploads"
--   on storage.objects for select
--   using (
--     bucket_id = 'file_uploads'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Policy: Authenticated users can upload files
-- Files are stored with user ID as folder prefix: {user_id}/{filename}
create policy "Authenticated users can upload files"
  on storage.objects for insert
  with check (
    bucket_id = 'file_uploads'
    and auth.role() = 'authenticated'
  );

-- Policy: Users can update their own files
create policy "Users can update their own file uploads"
  on storage.objects for update
  using (
    bucket_id = 'file_uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'file_uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own files
create policy "Users can delete their own file uploads"
  on storage.objects for delete
  using (
    bucket_id = 'file_uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Note: The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage
-- 2. Click "New bucket"
-- 3. Name: "file_uploads"
-- 4. Public bucket: Yes (if files should be publicly accessible) or No (if private)
-- 5. File size limit: Set appropriate limit (e.g., 50MB)
-- 6. Allowed MIME types: Leave empty or specify allowed types (e.g., application/pdf, image/*, etc.)

