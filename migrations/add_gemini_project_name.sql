-- Add Gemini project name setting to admin_settings
-- Run this in your Supabase SQL Editor

insert into admin_settings (key, value, category, description) values
  ('api_gemini_project_name', '""', 'api', 'Gemini project name/identifier')
on conflict (key) do nothing;

