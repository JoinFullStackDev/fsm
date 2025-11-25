-- Fix project_tasks phase_number constraint to allow dynamic phases
-- This migration updates the project_tasks table to allow phase numbers beyond 6

-- Drop the old constraint that limits phase_number to 1-6
alter table project_tasks
  drop constraint if exists project_tasks_phase_number_check;

-- Add new constraint allowing any positive integer
alter table project_tasks
  add constraint project_tasks_phase_number_positive 
  check (phase_number > 0);

