-- Simple query to find triggers on company_contacts
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

-- Find functions that might be called by triggers (simpler version)
SELECT 
    routine_name as function_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%activity_feed_items%';
