-- Add start_date column to project_tasks table
-- Run this in your Supabase SQL Editor

alter table project_tasks 
  add column if not exists start_date timestamptz;

-- Create index for better query performance
create index if not exists idx_project_tasks_start_date on project_tasks(start_date);

-- Add comment for documentation
comment on column project_tasks.start_date is 'The start date for the task. Used for Gantt chart visualization and timeline planning.';

