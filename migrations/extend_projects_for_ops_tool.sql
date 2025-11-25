-- Extend Projects Table for Ops Tool Integration
-- Run this in your Supabase SQL Editor

-- Add company_id column (nullable - existing projects won't have companies)
alter table projects 
  add column if not exists company_id uuid references companies(id) on delete set null;

-- Add source column (default 'Manual' for existing projects)
alter table projects 
  add column if not exists source text check (source in ('Manual', 'Converted')) default 'Manual';

-- Add opportunity_id column (nullable - only set when converted from opportunity)
alter table projects 
  add column if not exists opportunity_id uuid references opportunities(id) on delete set null;

-- Set default source for existing projects (if any exist without source)
update projects 
set source = 'Manual' 
where source is null;

-- Create indexes for better performance
create index if not exists idx_projects_company_id on projects(company_id);
create index if not exists idx_projects_source on projects(source);
create index if not exists idx_projects_opportunity_id on projects(opportunity_id);

-- Update RLS policies to allow reading projects by company_id
-- (Existing policies already cover project access, this is just for optimization)

