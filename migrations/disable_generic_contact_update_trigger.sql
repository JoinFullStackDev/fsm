-- Disable generic contact update trigger
-- We now handle contact updates more granularly in the API with specific activity feed items
-- for different types of changes (lead_status_changed, pipeline_stage_changed, etc.)

-- Drop the generic contact update trigger
drop trigger if exists trigger_contact_updated_activity on company_contacts;

-- Note: We keep the contact_created trigger since that's still useful
-- The API will create specific activity feed items for different types of contact updates

