-- Fix template_field_configs id column to ensure default is properly set
-- This ensures that when id is not provided, uuid_generate_v4() is used

-- First, ensure uuid_generate_v4() extension is enabled
create extension if not exists "uuid-ossp";

-- Verify the default is set correctly
-- If the column doesn't have a default, add it
do $$
begin
  -- Check if default exists
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'template_field_configs'
    and column_name = 'id'
    and column_default is not null
  ) then
    -- Add default if it doesn't exist
    alter table template_field_configs
      alter column id set default uuid_generate_v4();
    
    raise notice 'Added default uuid_generate_v4() to template_field_configs.id';
  else
    raise notice 'Default already exists for template_field_configs.id';
  end if;
end $$;

