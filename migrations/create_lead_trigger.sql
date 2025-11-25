-- Auto-Create Lead Trigger
-- Run this in your Supabase SQL Editor

-- Function to auto-create a lead when a contact is created
create or replace function auto_create_lead()
returns trigger as $$
begin
  -- Insert a lead record when a contact is created
  insert into leads (contact_id, company_id)
  values (new.id, new.company_id)
  on conflict (contact_id, company_id) do nothing;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger that fires after insert on company_contacts
drop trigger if exists trigger_auto_create_lead on company_contacts;
create trigger trigger_auto_create_lead
  after insert on company_contacts
  for each row
  execute function auto_create_lead();

