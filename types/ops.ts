// Ops Tool Type Definitions

export type CompanyStatus = 'active' | 'inactive' | 'prospect' | 'client' | 'archived';
export type ContactStatus = 'active' | 'inactive' | 'archived';
export type OpportunityStatus = 'new' | 'working' | 'negotiation' | 'pending' | 'converted' | 'lost';
export type OpportunitySource = 'Manual' | 'Contact' | 'Imported';
export type ProjectSource = 'Manual' | 'Converted';
export type ActivityEntityType = 'contact' | 'opportunity' | 'project' | 'task' | 'company';
export type ActivityEventType = 
  | 'task_created' 
  | 'task_updated' 
  | 'contact_created' 
  | 'contact_updated' 
  | 'opportunity_status_changed' 
  | 'opportunity_created' 
  | 'project_created' 
  | 'company_status_updated'
  | 'lead_status_changed'
  | 'pipeline_stage_changed'
  | 'tag_added'
  | 'tag_removed'
  | 'interaction_created'
  | 'assignment_changed'
  | 'attachment_uploaded';

// New enum types for amplified CRM fields
export type LeadSource = 'Referral' | 'Website' | 'Event' | 'Social Media' | 'Cold Outreach' | 'Partner' | 'Other';
export type LeadStatus = 'New' | 'Active' | 'Unqualified' | 'Nurturing' | 'Qualified' | 'Meeting Set' | 'Proposal Sent' | 'Closed Won' | 'Closed Lost';
export type PipelineStage = 'Lead' | 'MQL' | 'SQL' | 'Meeting' | 'Proposal' | 'Negotiation' | 'Closed';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type LifecycleStage = 'Lead' | 'MQL' | 'SQL' | 'Customer' | 'Advocate';
export type FollowUpType = 'Call' | 'Email' | 'Meeting' | 'LinkedIn' | 'Other';
export type PreferredCommunication = 'Email' | 'SMS' | 'Phone' | 'LinkedIn' | 'Other';
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
export type RevenueBand = '<$1M' | '$1M-$10M' | '$10M-$50M' | '$50M-$100M' | '$100M+';
export type InteractionType = 'Call' | 'Email' | 'Meeting' | 'Note' | 'LinkedIn' | 'Other';

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  notes: string | null;
  // New amplified fields
  company_size?: CompanySize | null;
  industry?: string | null;
  revenue_band?: RevenueBand | null;
  website?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  address_country?: string | null;
  account_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithCounts extends Company {
  contacts_count?: number;
  opportunities_count?: number;
  projects_count?: number;
}

export interface CompanyContact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: ContactStatus;
  // Contact Information
  job_title?: string | null;
  phone_mobile?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  address_country?: string | null;
  // Lead Source & Marketing
  lead_source?: LeadSource | null;
  campaign_initiative?: string | null;
  date_first_contacted?: string | null;
  original_inquiry_notes?: string | null;
  // Status & Pipeline
  lead_status?: LeadStatus | null;
  pipeline_stage?: PipelineStage | null;
  priority_level?: PriorityLevel | null;
  assigned_to?: string | null;
  lifecycle_stage?: LifecycleStage | null;
  // Activity Tracking
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
  follow_up_type?: FollowUpType | null;
  preferred_communication?: PreferredCommunication | null;
  // Preferences & Details
  is_decision_maker?: boolean | null;
  budget?: string | null;
  timeline_urgency?: string | null;
  pain_points_needs?: string | null;
  risk_flags?: string | null;
  // Customer-Specific Data
  customer_since_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  renewal_date?: string | null;
  subscription_level?: string | null;
  support_rep_csm?: string | null;
  health_score?: number | null;
  nps_score?: number | null;
  satisfaction_metrics?: Record<string, any> | null;
  // System Fields
  created_by?: string | null;
  modified_by?: string | null;
  email_opens?: number | null;
  email_clicks?: number | null;
  form_submission_data?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyContactWithCompany extends CompanyContact {
  company?: {
    id: string;
    name: string;
  };
}

export interface Lead {
  id: string;
  contact_id: string;
  company_id: string;
  created_at: string;
}

export interface Opportunity {
  id: string;
  company_id: string;
  name: string;
  value: number | null;
  status: OpportunityStatus;
  source: OpportunitySource;
  created_at: string;
  updated_at: string;
}

export interface OpportunityWithCompany extends Opportunity {
  company?: {
    id: string;
    name: string;
  };
}

export interface OpsTask {
  id: string;
  company_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  comments: TaskComment[];
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsTaskWithRelations extends OpsTask {
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  assigned_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  company?: {
    id: string;
    name: string;
  };
}

export interface TaskComment {
  id?: string;
  content: string;
  user_id?: string | null;
  created_at?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface ActivityFeedItem {
  id: string;
  company_id: string;
  related_entity_id: string | null;
  related_entity_type: ActivityEntityType;
  event_type: ActivityEventType;
  message: string;
  created_at: string;
}

export interface ActivityFeedItemWithEntity extends ActivityFeedItem {
  related_entity?: {
    id: string;
    name?: string;
    title?: string;
    [key: string]: any;
  } | null;
}

// New interfaces for tags, attachments, and interactions
export interface ContactTag {
  id: string;
  contact_id: string;
  tag_name: string;
  created_at: string;
}

export interface CompanyTag {
  id: string;
  company_id: string;
  tag_name: string;
  created_at: string;
}

export interface ContactAttachment {
  id: string;
  contact_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploaded_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface ContactInteraction {
  id: string;
  contact_id: string;
  interaction_type: InteractionType;
  subject: string | null;
  notes: string;
  interaction_date: string;
  created_by: string | null;
  created_at: string;
  created_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// Extended interfaces with relations
export interface CompanyContactWithRelations extends CompanyContact {
  company?: {
    id: string;
    name: string;
  };
  assigned_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  support_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  tags?: ContactTag[];
  attachments?: ContactAttachment[];
  interactions?: ContactInteraction[];
}

export interface CompanyWithTags extends Company {
  tags?: CompanyTag[];
}

