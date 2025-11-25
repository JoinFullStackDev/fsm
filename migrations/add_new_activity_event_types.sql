-- Add new event types to activity_feed_items table
-- This migration updates the CHECK constraint to include tag_added, interaction_created, and attachment_uploaded

-- Drop the old constraint
alter table activity_feed_items 
  drop constraint if exists activity_feed_items_event_type_check;

-- Add the new constraint with all event types
alter table activity_feed_items
  add constraint activity_feed_items_event_type_check 
  check (event_type in (
    'task_created', 
    'task_updated', 
    'contact_created', 
    'contact_updated', 
    'opportunity_status_changed', 
    'opportunity_created', 
    'project_created', 
    'company_status_updated',
    'lead_status_changed',
    'pipeline_stage_changed',
    'tag_added',
    'tag_removed',
    'interaction_created',
    'assignment_changed',
    'attachment_uploaded'
  ));

