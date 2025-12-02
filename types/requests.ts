export type RequestType = 'feature' | 'bug';

export type RequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type RequestPriority = 'low' | 'medium' | 'high' | 'critical';

export interface FeatureBugRequest {
  id: string;
  type: RequestType;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  page_url: string | null;
  steps_to_reproduce: string | null; // For bugs only
  expected_behavior: string | null; // For bugs only
  actual_behavior: string | null; // For bugs only
  user_id: string | null;
  organization_id: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureBugRequestCreate {
  type: RequestType;
  title: string;
  description: string;
  priority?: RequestPriority;
  page_url?: string | null;
  steps_to_reproduce?: string | null;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
}

export interface FeatureBugRequestUpdate {
  status?: RequestStatus;
  priority?: RequestPriority;
  assigned_to?: string | null;
  resolution_notes?: string | null;
}

export interface FeatureBugRequestWithUser extends FeatureBugRequest {
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  assigned_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  resolved_user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

