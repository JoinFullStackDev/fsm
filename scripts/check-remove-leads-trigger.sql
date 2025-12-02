-- Step 1: Check for triggers on company_contacts table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

-- Step 2: Check for functions that might reference leads
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%leads%'
  AND routine_schema = 'public';

-- Step 3: Check for foreign key constraints that reference leads
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (ccu.table_name = 'leads' OR tc.table_name = 'company_contacts');

-- Step 4: After running the queries above, if you find a trigger name,
-- replace 'YOUR_TRIGGER_NAME_HERE' below with the actual trigger name and run:
-- DROP TRIGGER IF EXISTS YOUR_TRIGGER_NAME_HERE ON company_contacts;

-- Step 5: Also check and drop any functions that create leads
-- (Replace 'YOUR_FUNCTION_NAME_HERE' with the actual function name from Step 2)
-- DROP FUNCTION IF EXISTS YOUR_FUNCTION_NAME_HERE();
