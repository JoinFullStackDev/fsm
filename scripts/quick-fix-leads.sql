-- QUICK FIX: Remove the auto_create_lead function and any triggers that use it
-- Run this in your Supabase SQL Editor

-- Drop the function (CASCADE will also drop any triggers that depend on it)
DROP FUNCTION IF EXISTS auto_create_lead() CASCADE;

-- Verify it's gone (should return empty)
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'auto_create_lead';

-- Also check for any remaining triggers on company_contacts
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';
