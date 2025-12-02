-- Simple query to find ALL triggers on company_contacts table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

-- If the above returns any triggers, you can drop them with:
-- DROP TRIGGER IF EXISTS <trigger_name> ON company_contacts;

-- Alternative: Try dropping common trigger names (run these one at a time)
-- DROP TRIGGER IF EXISTS create_lead_on_contact_insert ON company_contacts;
-- DROP TRIGGER IF EXISTS auto_create_lead ON company_contacts;
-- DROP TRIGGER IF EXISTS company_contacts_insert_trigger ON company_contacts;
-- DROP TRIGGER IF EXISTS on_contact_insert_create_lead ON company_contacts;
-- DROP TRIGGER IF EXISTS trigger_create_lead ON company_contacts;

-- Also check for functions that might be called by triggers
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) LIKE '%leads%';

-- If you find a function that references leads, drop it with:
-- DROP FUNCTION IF EXISTS <function_name>() CASCADE;
