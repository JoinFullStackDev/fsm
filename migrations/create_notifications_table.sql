-- Notifications System
-- Run this in your Supabase SQL Editor

-- Create notifications table
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  type text not null check (type in ('task_assigned', 'comment_created', 'comment_mention', 'project_created', 'project_member_added')),
  title text not null,
  message text not null,
  read boolean default false not null,
  read_at timestamptz,
  metadata jsonb default '{}'::jsonb, -- Stores related entity IDs (task_id, project_id, comment_id, assigner_id, etc.)
  created_at timestamptz default now() not null
);

-- Create indexes for better performance
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_read on notifications(read);
create index if not exists idx_notifications_created_at on notifications(created_at desc);
create index if not exists idx_notifications_user_read on notifications(user_id, read);
create index if not exists idx_notifications_type on notifications(type);

-- RLS Policies
alter table notifications enable row level security;

-- Users can view their own notifications
create policy "Users can view own notifications"
  on notifications for select
  using (
    user_id in (
      select id from users where auth_id = auth.uid()
    )
  );

-- Users can update their own notifications (mark as read)
create policy "Users can update own notifications"
  on notifications for update
  using (
    user_id in (
      select id from users where auth_id = auth.uid()
    )
  )
  with check (
    user_id in (
      select id from users where auth_id = auth.uid()
    )
  );

-- Users can delete their own notifications
create policy "Users can delete own notifications"
  on notifications for delete
  using (
    user_id in (
      select id from users where auth_id = auth.uid()
    )
  );

-- System can insert notifications (via service role or function)
-- This allows the application to create notifications for users
create policy "Service can insert notifications"
  on notifications for insert
  with check (true);

-- Enable Realtime for notifications table
alter publication supabase_realtime add table notifications;

-- Function to automatically update read_at when read is set to true
create or replace function update_notification_read_at()
returns trigger as $$
begin
  if new.read = true and old.read = false then
    new.read_at = now();
  elsif new.read = false then
    new.read_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger update_notification_read_at
  before update on notifications
  for each row
  when (old.read is distinct from new.read)
  execute function update_notification_read_at();

