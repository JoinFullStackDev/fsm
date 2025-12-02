-- Fix: Remove the trigger and function that's causing the error

-- Step 1: Drop the trigger that calls auto_create_lead()
DROP TRIGGER IF EXISTS auto_create_lead_trigger ON company_contacts;
DROP TRIGGER IF EXISTS create_lead_trigger ON company_contacts;
DROP TRIGGER IF EXISTS on_contact_insert_trigger ON company_contacts;

-- Step 2: Find the actual trigger name (run this first to see what triggers exist)
SELECT 
    trigger_name,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts'
AND action_statement LIKE '%auto_create_lead%';

-- Step 3: Drop the function that's causing the issue
DROP FUNCTION IF EXISTS auto_create_lead() CASCADE;

-- Step 4: Verify it's gone
SELECT 
    trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'auto_create_lead';
