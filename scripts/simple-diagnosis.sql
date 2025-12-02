-- Simple diagnosis - run this to see what's causing the issue

-- 1. Check if there are ANY triggers on company_contacts
SELECT trigger_name 
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

-- If the above returns empty (no triggers), then the issue might be:
-- - A database function being called
-- - A view
-- - Or the error is actually coming from the application code (cached)

-- 2. Quick check: Does the leads table exist? (It shouldn't)
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'leads'
) as leads_table_exists;
