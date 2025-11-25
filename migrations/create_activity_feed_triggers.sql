-- Activity Feed Triggers
-- Run this in your Supabase SQL Editor

-- Function to create activity feed item for contact creation
create or replace function create_contact_created_activity()
returns trigger as $$
begin
  insert into activity_feed_items (
    company_id,
    related_entity_id,
    related_entity_type,
    event_type,
    message
  )
  values (
    new.company_id,
    new.id,
    'contact',
    'contact_created',
    'Contact ' || new.first_name || ' ' || new.last_name || ' was added'
  );
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for contact update
create or replace function create_contact_updated_activity()
returns trigger as $$
begin
  insert into activity_feed_items (
    company_id,
    related_entity_id,
    related_entity_type,
    event_type,
    message
  )
  values (
    new.company_id,
    new.id,
    'contact',
    'contact_updated',
    'Contact ' || new.first_name || ' ' || new.last_name || ' was updated'
  );
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for task creation
create or replace function create_task_created_activity()
returns trigger as $$
begin
  insert into activity_feed_items (
    company_id,
    related_entity_id,
    related_entity_type,
    event_type,
    message
  )
  values (
    new.company_id,
    new.id,
    'task',
    'task_created',
    'Task "' || new.title || '" was created'
  );
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for task update
create or replace function create_task_updated_activity()
returns trigger as $$
begin
  insert into activity_feed_items (
    company_id,
    related_entity_id,
    related_entity_type,
    event_type,
    message
  )
  values (
    new.company_id,
    new.id,
    'task',
    'task_updated',
    'Task "' || new.title || '" was updated'
  );
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for opportunity status change
create or replace function create_opportunity_status_changed_activity()
returns trigger as $$
begin
  -- Only create activity if status actually changed
  if old.status is distinct from new.status then
    insert into activity_feed_items (
      company_id,
      related_entity_id,
      related_entity_type,
      event_type,
      message
    )
    values (
      new.company_id,
      new.id,
      'opportunity',
      'opportunity_status_changed',
      'Opportunity "' || new.name || '" status changed from ' || old.status || ' to ' || new.status
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for opportunity creation
create or replace function create_opportunity_created_activity()
returns trigger as $$
begin
  insert into activity_feed_items (
    company_id,
    related_entity_id,
    related_entity_type,
    event_type,
    message
  )
  values (
    new.company_id,
    new.id,
    'opportunity',
    'opportunity_created',
    'Opportunity "' || new.name || '" was created'
  );
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for project creation (when company_id is set)
create or replace function create_project_created_activity()
returns trigger as $$
begin
  -- Only create activity if project has a company_id
  if new.company_id is not null then
    insert into activity_feed_items (
      company_id,
      related_entity_id,
      related_entity_type,
      event_type,
      message
    )
    values (
      new.company_id,
      new.id,
      'project',
      'project_created',
      'Project "' || new.name || '" was created'
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- Function to create activity feed item for company status update
create or replace function create_company_status_updated_activity()
returns trigger as $$
begin
  -- Only create activity if status actually changed
  if old.status is distinct from new.status then
    insert into activity_feed_items (
      company_id,
      related_entity_id,
      related_entity_type,
      event_type,
      message
    )
    values (
      new.id,
      new.id,
      'company',
      'company_status_updated',
      'Company "' || new.name || '" status changed from ' || old.status || ' to ' || new.status
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- Drop existing triggers if they exist
drop trigger if exists trigger_contact_created_activity on company_contacts;
drop trigger if exists trigger_contact_updated_activity on company_contacts;
drop trigger if exists trigger_task_created_activity on ops_tasks;
drop trigger if exists trigger_task_updated_activity on ops_tasks;
drop trigger if exists trigger_opportunity_status_changed_activity on opportunities;
drop trigger if exists trigger_opportunity_created_activity on opportunities;
drop trigger if exists trigger_project_created_activity on projects;
drop trigger if exists trigger_company_status_updated_activity on companies;

-- Create triggers
create trigger trigger_contact_created_activity
  after insert on company_contacts
  for each row
  execute function create_contact_created_activity();

create trigger trigger_contact_updated_activity
  after update on company_contacts
  for each row
  execute function create_contact_updated_activity();

create trigger trigger_task_created_activity
  after insert on ops_tasks
  for each row
  execute function create_task_created_activity();

create trigger trigger_task_updated_activity
  after update on ops_tasks
  for each row
  execute function create_task_updated_activity();

create trigger trigger_opportunity_status_changed_activity
  after update on opportunities
  for each row
  execute function create_opportunity_status_changed_activity();

create trigger trigger_opportunity_created_activity
  after insert on opportunities
  for each row
  execute function create_opportunity_created_activity();

create trigger trigger_project_created_activity
  after insert on projects
  for each row
  execute function create_project_created_activity();

create trigger trigger_company_status_updated_activity
  after update on companies
  for each row
  execute function create_company_status_updated_activity();

