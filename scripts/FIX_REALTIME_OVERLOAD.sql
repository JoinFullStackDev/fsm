-- ============================================================
-- FIX REALTIME OVERLOAD
-- Run this in Supabase SQL Editor to stop the database flooding
-- ============================================================

-- STEP 1: Check current realtime configuration
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- ============================================================
-- STEP 2: EMERGENCY - Drop and recreate publication with ONLY notifications
-- ============================================================

DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE public.notifications;

-- ============================================================
-- STEP 3: Verify the change (should only show notifications)
-- ============================================================

SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
