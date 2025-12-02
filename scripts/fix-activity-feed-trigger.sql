-- Find the trigger that's causing the issue
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

-- Find the function that the trigger calls (simpler approach)
SELECT 
    routine_name as function_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%activity_feed_items%';

-- Once you find the trigger name, you can either:
-- 1. Fix the function to handle errors gracefully
-- 2. Or drop the trigger and let the application code handle it

-- To drop the trigger (replace TRIGGER_NAME with actual name):
-- DROP TRIGGER IF EXISTS TRIGGER_NAME ON company_contacts;
