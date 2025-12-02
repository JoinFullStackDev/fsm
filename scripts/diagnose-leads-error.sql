-- Comprehensive diagnosis: Find what's referencing the 'leads' table

-- 1. Check for triggers on company_contacts
SELECT 'TRIGGERS' as check_type, trigger_name as name, action_statement as details
FROM information_schema.triggers
WHERE event_object_table = 'company_contacts';

-- 2. Check for views that reference leads
SELECT 'VIEWS' as check_type, table_name as name, view_definition as details
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%leads%';

-- 3. Check for functions that reference leads
SELECT 'FUNCTIONS' as check_type, 
       p.proname as name,
       pg_get_functiondef(p.oid) as details
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) LIKE '%leads%';

-- 4. Check for default values or constraints on company_contacts that might reference leads
SELECT 'COLUMNS' as check_type,
       column_name as name,
       column_default as details
FROM information_schema.columns
WHERE table_name = 'company_contacts'
AND column_default LIKE '%leads%';

-- 5. Check if leads table exists (it shouldn't)
SELECT 'TABLE_EXISTS' as check_type,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name = 'leads'
       ) THEN 'leads table EXISTS (should be dropped)' 
       ELSE 'leads table does NOT exist (this is correct)' 
       END as details;
