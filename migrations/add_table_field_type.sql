-- Add 'table' field type to template_field_configs
-- Run this in your Supabase SQL Editor

-- Update the check constraint to include 'table' as a valid field type
alter table template_field_configs 
  drop constraint if exists template_field_configs_field_type_check;

alter table template_field_configs 
  add constraint template_field_configs_field_type_check 
  check (field_type in ('text', 'textarea', 'array', 'object', 'select', 'checkbox', 'slider', 'date', 'file', 'table', 'custom'));

