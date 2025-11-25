-- Amplify Companies and Contacts - Database Schema Enhancement
-- Run this in your Supabase SQL Editor
-- This migration adds comprehensive CRM fields to companies and contacts

-- Phase 1.1: Create New Enum Types

-- Lead source enum
create type lead_source as enum (
  'Referral',
  'Website',
  'Event',
  'Social Media',
  'Cold Outreach',
  'Partner',
  'Other'
);

-- Lead status enum
create type lead_status as enum (
  'New',
  'Active',
  'Unqualified',
  'Nurturing',
  'Qualified',
  'Meeting Set',
  'Proposal Sent',
  'Closed Won',
  'Closed Lost'
);

-- Pipeline stage enum
create type pipeline_stage as enum (
  'Lead',
  'MQL',
  'SQL',
  'Meeting',
  'Proposal',
  'Negotiation',
  'Closed'
);

-- Priority level enum
create type priority_level as enum (
  'Low',
  'Medium',
  'High',
  'Critical'
);

-- Lifecycle stage enum
create type lifecycle_stage as enum (
  'Lead',
  'MQL',
  'SQL',
  'Customer',
  'Advocate'
);

-- Follow-up type enum
create type follow_up_type as enum (
  'Call',
  'Email',
  'Meeting',
  'LinkedIn',
  'Other'
);

-- Preferred communication enum
create type preferred_communication as enum (
  'Email',
  'SMS',
  'Phone',
  'LinkedIn',
  'Other'
);

-- Company size enum
create type company_size as enum (
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+'
);

-- Revenue band enum
create type revenue_band as enum (
  '<$1M',
  '$1M-$10M',
  '$10M-$50M',
  '$50M-$100M',
  '$100M+'
);

-- Phase 1.2: Extend Companies Table

alter table companies
  add column if not exists company_size company_size,
  add column if not exists industry text,
  add column if not exists revenue_band revenue_band,
  add column if not exists website text,
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_zip text,
  add column if not exists address_country text,
  add column if not exists account_notes text;

-- Phase 1.3: Extend Company Contacts Table

alter table company_contacts
  -- Contact Information
  add column if not exists job_title text,
  add column if not exists phone_mobile text,
  add column if not exists website text,
  add column if not exists linkedin_url text,
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_zip text,
  add column if not exists address_country text,
  -- Lead Source & Marketing
  add column if not exists lead_source lead_source,
  add column if not exists campaign_initiative text,
  add column if not exists date_first_contacted timestamptz,
  add column if not exists original_inquiry_notes text,
  -- Status & Pipeline
  add column if not exists lead_status lead_status,
  add column if not exists pipeline_stage pipeline_stage,
  add column if not exists priority_level priority_level,
  add column if not exists assigned_to uuid references users(id) on delete set null,
  add column if not exists lifecycle_stage lifecycle_stage,
  -- Activity Tracking
  add column if not exists last_contact_date timestamptz,
  add column if not exists next_follow_up_date timestamptz,
  add column if not exists follow_up_type follow_up_type,
  add column if not exists preferred_communication preferred_communication,
  -- Preferences & Details
  add column if not exists is_decision_maker boolean default false,
  add column if not exists budget text,
  add column if not exists timeline_urgency text,
  add column if not exists pain_points_needs text,
  add column if not exists risk_flags text,
  -- Customer-Specific Data
  add column if not exists customer_since_date timestamptz,
  add column if not exists contract_start_date timestamptz,
  add column if not exists contract_end_date timestamptz,
  add column if not exists renewal_date timestamptz,
  add column if not exists subscription_level text,
  add column if not exists support_rep_csm uuid references users(id) on delete set null,
  add column if not exists health_score integer check (health_score >= 0 and health_score <= 100),
  add column if not exists nps_score integer check (nps_score >= -100 and nps_score <= 100),
  add column if not exists satisfaction_metrics jsonb default '{}'::jsonb,
  -- System Fields
  add column if not exists created_by uuid references users(id) on delete set null,
  add column if not exists modified_by uuid references users(id) on delete set null,
  add column if not exists email_opens integer default 0,
  add column if not exists email_clicks integer default 0,
  add column if not exists form_submission_data jsonb default '{}'::jsonb;

-- Phase 1.4: Create New Tables

-- Contact Tags Table
create table if not exists contact_tags (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references company_contacts(id) on delete cascade not null,
  tag_name text not null,
  created_at timestamptz default now() not null,
  unique(contact_id, tag_name)
);

-- Contact Attachments Table
create table if not exists contact_attachments (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references company_contacts(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Contact Interaction History Table
create table if not exists contact_interactions (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references company_contacts(id) on delete cascade not null,
  interaction_type text check (interaction_type in ('Call', 'Email', 'Meeting', 'Note', 'LinkedIn', 'Other')) not null,
  subject text,
  notes text not null,
  interaction_date timestamptz default now() not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Company Tags Table
create table if not exists company_tags (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade not null,
  tag_name text not null,
  created_at timestamptz default now() not null,
  unique(company_id, tag_name)
);

-- Phase 1.5: Create Indexes

-- Indexes for company_contacts
create index if not exists idx_company_contacts_assigned_to on company_contacts(assigned_to);
create index if not exists idx_company_contacts_lead_source on company_contacts(lead_source);
create index if not exists idx_company_contacts_lead_status on company_contacts(lead_status);
create index if not exists idx_company_contacts_pipeline_stage on company_contacts(pipeline_stage);
create index if not exists idx_company_contacts_next_follow_up_date on company_contacts(next_follow_up_date);
create index if not exists idx_company_contacts_lifecycle_stage on company_contacts(lifecycle_stage);
create index if not exists idx_company_contacts_last_contact_date on company_contacts(last_contact_date);

-- Indexes for contact_tags
create index if not exists idx_contact_tags_contact_id on contact_tags(contact_id);
create index if not exists idx_contact_tags_tag_name on contact_tags(tag_name);

-- Indexes for contact_attachments
create index if not exists idx_contact_attachments_contact_id on contact_attachments(contact_id);

-- Indexes for contact_interactions
create index if not exists idx_contact_interactions_contact_id on contact_interactions(contact_id);
create index if not exists idx_contact_interactions_interaction_date on contact_interactions(interaction_date desc);
create index if not exists idx_contact_interactions_interaction_type on contact_interactions(interaction_type);

-- Indexes for company_tags
create index if not exists idx_company_tags_company_id on company_tags(company_id);
create index if not exists idx_company_tags_tag_name on company_tags(tag_name);

-- Indexes for companies
create index if not exists idx_companies_industry on companies(industry);
create index if not exists idx_companies_company_size on companies(company_size);
create index if not exists idx_companies_revenue_band on companies(revenue_band);

-- Enable Row Level Security (RLS) for new tables
alter table contact_tags enable row level security;
alter table contact_attachments enable row level security;
alter table contact_interactions enable row level security;
alter table company_tags enable row level security;

-- RLS Policies for contact_tags
drop policy if exists "Users can read contact tags" on contact_tags;
create policy "Users can read contact tags"
  on contact_tags for select
  using (auth.uid() is not null);

drop policy if exists "Users can create contact tags" on contact_tags;
create policy "Users can create contact tags"
  on contact_tags for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can delete contact tags" on contact_tags;
create policy "Users can delete contact tags"
  on contact_tags for delete
  using (auth.uid() is not null);

-- RLS Policies for contact_attachments
drop policy if exists "Users can read contact attachments" on contact_attachments;
create policy "Users can read contact attachments"
  on contact_attachments for select
  using (auth.uid() is not null);

drop policy if exists "Users can create contact attachments" on contact_attachments;
create policy "Users can create contact attachments"
  on contact_attachments for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can delete contact attachments" on contact_attachments;
create policy "Users can delete contact attachments"
  on contact_attachments for delete
  using (auth.uid() is not null);

-- RLS Policies for contact_interactions
drop policy if exists "Users can read contact interactions" on contact_interactions;
create policy "Users can read contact interactions"
  on contact_interactions for select
  using (auth.uid() is not null);

drop policy if exists "Users can create contact interactions" on contact_interactions;
create policy "Users can create contact interactions"
  on contact_interactions for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can update contact interactions" on contact_interactions;
create policy "Users can update contact interactions"
  on contact_interactions for update
  using (auth.uid() is not null);

drop policy if exists "Users can delete contact interactions" on contact_interactions;
create policy "Users can delete contact interactions"
  on contact_interactions for delete
  using (auth.uid() is not null);

-- RLS Policies for company_tags
drop policy if exists "Users can read company tags" on company_tags;
create policy "Users can read company tags"
  on company_tags for select
  using (auth.uid() is not null);

drop policy if exists "Users can create company tags" on company_tags;
create policy "Users can create company tags"
  on company_tags for insert
  with check (auth.uid() is not null);

drop policy if exists "Users can delete company tags" on company_tags;
create policy "Users can delete company tags"
  on company_tags for delete
  using (auth.uid() is not null);

