-- Create admin_settings table for storing admin configuration
-- Run this in your Supabase SQL Editor

create table if not exists admin_settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  category text not null check (category in ('theme', 'api', 'system', 'email')),
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references users(id),
  created_at timestamptz default now()
);

-- Create indexes
create index if not exists idx_admin_settings_category on admin_settings(category);
create index if not exists idx_admin_settings_key on admin_settings(key);

-- Insert default settings
insert into admin_settings (key, value, category, description) values
  ('theme_primary', '{"main": "#00E5FF", "light": "#5DFFFF", "dark": "#00B2CC"}', 'theme', 'Primary theme color'),
  ('theme_secondary', '{"main": "#E91E63", "light": "#FF6090", "dark": "#B0003A"}', 'theme', 'Secondary theme color'),
  ('theme_background', '{"default": "#0A0E27", "paper": "#121633"}', 'theme', 'Background colors'),
  ('api_gemini_enabled', 'true', 'api', 'Enable/disable Gemini AI features'),
  ('api_gemini_key', '""', 'api', 'Gemini API key (encrypted)'),
  ('api_gemini_project_name', '""', 'api', 'Gemini project name/identifier'),
  ('system_maintenance_mode', 'false', 'system', 'Enable maintenance mode'),
  ('system_app_name', '"FullStack Method™ App"', 'system', 'Application name'),
  ('email_signup_template', '{"subject": "Welcome to FullStack Method™", "body": "Welcome!"}', 'email', 'Signup email template')
on conflict (key) do nothing;

-- RLS Policies
alter table admin_settings enable row level security;

-- Only admins can view and modify settings
create policy "Admins can view all settings"
  on admin_settings for select
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

create policy "Admins can insert settings"
  on admin_settings for insert
  with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

create policy "Admins can update settings"
  on admin_settings for update
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

create policy "Admins can delete settings"
  on admin_settings for delete
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

