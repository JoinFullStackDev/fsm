-- Create activity_logs table for tracking user actions
-- Run this in your Supabase SQL Editor

create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  action_type text not null, -- 'project_created', 'export_generated', 'phase_completed', 'ai_used', 'user_updated', etc.
  resource_type text, -- 'project', 'export', 'phase', 'user', etc.
  resource_id uuid, -- ID of the resource (project_id, export_id, etc.)
  metadata jsonb default '{}'::jsonb, -- Additional context about the action
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- Create indexes for better query performance
create index if not exists idx_activity_logs_user_id on activity_logs(user_id);
create index if not exists idx_activity_logs_action_type on activity_logs(action_type);
create index if not exists idx_activity_logs_resource on activity_logs(resource_type, resource_id);
create index if not exists idx_activity_logs_created_at on activity_logs(created_at desc);

-- RLS Policies
alter table activity_logs enable row level security;

-- Users can view their own activity
create policy "Users can view own activity"
  on activity_logs for select
  using (
    user_id in (
      select id from users where auth_id = auth.uid()
    )
  );

-- Admins can view all activity
create policy "Admins can view all activity"
  on activity_logs for select
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.role = 'admin'
    )
  );

-- System can insert activity logs (via service role or function)
create policy "Service can insert activity logs"
  on activity_logs for insert
  with check (true);

-- Function to log activity (can be called from application)
create or replace function log_activity(
  p_user_id uuid,
  p_action_type text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  log_id uuid;
begin
  insert into activity_logs (user_id, action_type, resource_type, resource_id, metadata)
  values (p_user_id, p_action_type, p_resource_type, p_resource_id, p_metadata)
  returning id into log_id;
  
  -- Update user's last_active_at
  update users
  set last_active_at = now()
  where id = p_user_id;
  
  return log_id;
end;
$$;

