-- Task Comments System
-- Run this in your Supabase SQL Editor

-- Create task_comments table
create table if not exists task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references project_tasks(id) on delete cascade not null,
  user_id uuid references users(id) on delete set null,
  content text not null,
  mentioned_user_ids uuid[] default '{}', -- Array of user IDs mentioned in the comment
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create indexes for better performance
create index if not exists idx_task_comments_task_id on task_comments(task_id);
create index if not exists idx_task_comments_user_id on task_comments(user_id);
create index if not exists idx_task_comments_created_at on task_comments(created_at desc);

-- RLS Policies
alter table task_comments enable row level security;

-- Users can view comments for tasks in projects they have access to
create policy "Users can view task comments"
  on task_comments for select
  using (
    exists (
      select 1 from project_tasks pt
      join projects p on pt.project_id = p.id
      where pt.id = task_comments.task_id
      and (
        p.owner_id in (select id from users where auth_id = auth.uid())
        or exists (
          select 1 from project_members pm
          join users u on pm.user_id = u.id
          where pm.project_id = p.id
          and u.auth_id = auth.uid()
        )
      )
    )
  );

-- Users can insert comments for tasks in projects they have access to
create policy "Users can insert task comments"
  on task_comments for insert
  with check (
    exists (
      select 1 from project_tasks pt
      join projects p on pt.project_id = p.id
      where pt.id = task_comments.task_id
      and (
        p.owner_id in (select id from users where auth_id = auth.uid())
        or exists (
          select 1 from project_members pm
          join users u on pm.user_id = u.id
          where pm.project_id = p.id
          and u.auth_id = auth.uid()
        )
      )
    )
    and user_id in (select id from users where auth_id = auth.uid())
  );

-- Users can update their own comments
create policy "Users can update own comments"
  on task_comments for update
  using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

-- Users can delete their own comments
create policy "Users can delete own comments"
  on task_comments for delete
  using (user_id in (select id from users where auth_id = auth.uid()));

-- Function to update updated_at timestamp
create or replace function update_task_comment_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_task_comment_updated_at
  before update on task_comments
  for each row
  execute function update_task_comment_updated_at();

