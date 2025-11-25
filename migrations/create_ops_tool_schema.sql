-- Ops Tool - Database Schema
-- Run this in your Supabase SQL Editor

-- Companies table
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text check (status in ('active', 'inactive', 'prospect', 'client', 'archived')) default 'active',
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Company contacts table
create table if not exists company_contacts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  status text check (status in ('active', 'inactive', 'archived')) default 'active',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Leads table (implicit entity - auto-created when contact is created)
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references company_contacts(id) on delete cascade not null,
  company_id uuid references companies(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(contact_id, company_id)
);

-- Opportunities table
create table if not exists opportunities (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  value numeric(12, 2),
  status text check (status in ('new', 'working', 'negotiation', 'pending', 'converted', 'lost')) default 'new',
  source text check (source in ('Manual', 'Contact', 'Imported')) default 'Manual',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ops tasks table (separate from project_tasks)
create table if not exists ops_tasks (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade not null,
  contact_id uuid references company_contacts(id) on delete set null,
  title text not null,
  description text,
  notes text,
  comments jsonb default '[]'::jsonb,
  assigned_to uuid references users(id) on delete set null,
  due_date timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Activity feed items table
create table if not exists activity_feed_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade not null,
  related_entity_id uuid,
  related_entity_type text check (related_entity_type in ('contact', 'opportunity', 'project', 'task', 'company')) not null,
  event_type text check (event_type in ('task_created', 'task_updated', 'contact_created', 'contact_updated', 'opportunity_status_changed', 'opportunity_created', 'project_created', 'company_status_updated')) not null,
  message text not null,
  created_at timestamptz default now() not null
);

-- Create indexes for better performance
create index if not exists idx_companies_status on companies(status);
create index if not exists idx_companies_created_at on companies(created_at);
create index if not exists idx_company_contacts_company_id on company_contacts(company_id);
create index if not exists idx_company_contacts_email on company_contacts(email);
create index if not exists idx_company_contacts_status on company_contacts(status);
create index if not exists idx_leads_contact_id on leads(contact_id);
create index if not exists idx_leads_company_id on leads(company_id);
create index if not exists idx_opportunities_company_id on opportunities(company_id);
create index if not exists idx_opportunities_status on opportunities(status);
create index if not exists idx_opportunities_created_at on opportunities(created_at);
create index if not exists idx_ops_tasks_company_id on ops_tasks(company_id);
create index if not exists idx_ops_tasks_contact_id on ops_tasks(contact_id);
create index if not exists idx_ops_tasks_assigned_to on ops_tasks(assigned_to);
create index if not exists idx_activity_feed_items_company_id on activity_feed_items(company_id);
create index if not exists idx_activity_feed_items_created_at on activity_feed_items(created_at desc);
create index if not exists idx_activity_feed_items_related_entity on activity_feed_items(related_entity_type, related_entity_id);

-- Enable Row Level Security (RLS)
alter table companies enable row level security;
alter table company_contacts enable row level security;
alter table leads enable row level security;
alter table opportunities enable row level security;
alter table ops_tasks enable row level security;
alter table activity_feed_items enable row level security;

-- RLS Policies for companies
-- All authenticated users can read companies (v1 - no RBAC)
drop policy if exists "Users can read companies" on companies;
create policy "Users can read companies"
  on companies for select
  using (auth.uid() is not null);

drop policy if exists "Users can create companies" on companies;
create policy "Users can create companies"
  on companies for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can update companies" on companies;
create policy "Users can update companies"
  on companies for update
  using (auth.uid() is not null);

drop policy if exists "Users can delete companies" on companies;
create policy "Users can delete companies"
  on companies for delete
  using (auth.uid() is not null);

-- RLS Policies for company_contacts
drop policy if exists "Users can read company contacts" on company_contacts;
create policy "Users can read company contacts"
  on company_contacts for select
  using (auth.uid() is not null);

drop policy if exists "Users can create company contacts" on company_contacts;
create policy "Users can create company contacts"
  on company_contacts for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can update company contacts" on company_contacts;
create policy "Users can update company contacts"
  on company_contacts for update
  using (auth.uid() is not null);

drop policy if exists "Users can delete company contacts" on company_contacts;
create policy "Users can delete company contacts"
  on company_contacts for delete
  using (auth.uid() is not null);

-- RLS Policies for leads
drop policy if exists "Users can read leads" on leads;
create policy "Users can read leads"
  on leads for select
  using (auth.uid() is not null);

drop policy if exists "Users can create leads" on leads;
create policy "Users can create leads"
  on leads for insert
  with check (auth.uid() is not null);

-- RLS Policies for opportunities
drop policy if exists "Users can read opportunities" on opportunities;
create policy "Users can read opportunities"
  on opportunities for select
  using (auth.uid() is not null);

drop policy if exists "Users can create opportunities" on opportunities;
create policy "Users can create opportunities"
  on opportunities for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can update opportunities" on opportunities;
create policy "Users can update opportunities"
  on opportunities for update
  using (auth.uid() is not null);

drop policy if exists "Users can delete opportunities" on opportunities;
create policy "Users can delete opportunities"
  on opportunities for delete
  using (auth.uid() is not null);

-- RLS Policies for ops_tasks
drop policy if exists "Users can read ops tasks" on ops_tasks;
create policy "Users can read ops tasks"
  on ops_tasks for select
  using (auth.uid() is not null);

drop policy if exists "Users can create ops tasks" on ops_tasks;
create policy "Users can create ops tasks"
  on ops_tasks for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can update ops tasks" on ops_tasks;
create policy "Users can update ops tasks"
  on ops_tasks for update
  using (auth.uid() is not null);

drop policy if exists "Users can delete ops tasks" on ops_tasks;
create policy "Users can delete ops tasks"
  on ops_tasks for delete
  using (auth.uid() is not null);

-- RLS Policies for activity_feed_items
drop policy if exists "Users can read activity feed items" on activity_feed_items;
create policy "Users can read activity feed items"
  on activity_feed_items for select
  using (auth.uid() is not null);

drop policy if exists "Users can create activity feed items" on activity_feed_items;
create policy "Users can create activity feed items"
  on activity_feed_items for insert
  with check (auth.uid() is not null);

-- Create trigger function to update updated_at timestamp
create or replace function update_ops_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
drop trigger if exists update_companies_updated_at on companies;
create trigger update_companies_updated_at
  before update on companies
  for each row
  execute function update_ops_updated_at_column();

drop trigger if exists update_company_contacts_updated_at on company_contacts;
create trigger update_company_contacts_updated_at
  before update on company_contacts
  for each row
  execute function update_ops_updated_at_column();

drop trigger if exists update_opportunities_updated_at on opportunities;
create trigger update_opportunities_updated_at
  before update on opportunities
  for each row
  execute function update_ops_updated_at_column();

drop trigger if exists update_ops_tasks_updated_at on ops_tasks;
create trigger update_ops_tasks_updated_at
  before update on ops_tasks
  for each row
  execute function update_ops_updated_at_column();

