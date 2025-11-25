-- Quick diagnostic queries to check user setup
-- Run these in your Supabase SQL Editor

-- 1. Check if create_user_record function exists
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'create_user_record';

-- 2. Check users table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Check RLS policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users';

-- 4. List all users (if you have access)
SELECT id, email, name, role, created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;
