-- Remove triggers and functions that reference the 'leads' table
-- Run this after identifying the trigger/function names from check-remove-leads-trigger.sql

-- First, let's find all triggers on company_contacts that might reference leads
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'company_contacts'
    LOOP
        -- Check if the trigger's function references 'leads'
        IF EXISTS (
            SELECT 1
            FROM information_schema.routines r
            JOIN pg_trigger t ON t.tgname = trigger_record.trigger_name
            JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE p.proname = r.routine_name
            AND r.routine_definition LIKE '%leads%'
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON company_contacts', trigger_record.trigger_name);
            RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
        END IF;
    END LOOP;
END $$;

-- Find and drop functions that reference 'leads'
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT routine_name, routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_definition LIKE '%leads%'
        AND routine_definition LIKE '%INSERT%'
    LOOP
        -- Try to drop the function (may need to specify parameters)
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I() CASCADE', func_record.routine_name);
            RAISE NOTICE 'Dropped function: %', func_record.routine_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop function % (may need parameters): %', func_record.routine_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- Alternative: Simple approach - drop all triggers on company_contacts
-- Uncomment the line below if the above doesn't work:
-- DROP TRIGGER IF EXISTS create_lead_on_contact_insert ON company_contacts;
-- DROP TRIGGER IF EXISTS auto_create_lead ON company_contacts;
-- DROP TRIGGER IF EXISTS company_contacts_insert_trigger ON company_contacts;
