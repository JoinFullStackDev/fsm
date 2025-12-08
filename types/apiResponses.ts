/**
 * API Response Types
 * Standardized types for API responses to ensure type safety across the application
 */

// ============================================================================
// Base Response Types
// ============================================================================

/**
 * Standard successful API response
 */
export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

/**
 * Standard error API response
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Combined API response type
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Paginated response type
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
}

// ============================================================================
// Auth Responses
// ============================================================================

export interface AuthUserResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  } | null;
  error?: string;
}

// ============================================================================
// User Responses
// ============================================================================

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organization_id: string | null;
  is_super_admin?: boolean;
  is_company_admin?: boolean;
  avatar_url?: string | null;
}

export interface UserListResponse {
  users: UserResponse[];
  total?: number;
}

export interface UserRolesResponse {
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
    isDefault?: boolean;
  }>;
}

// ============================================================================
// Organization Responses
// ============================================================================

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  settings?: Record<string, unknown>;
}

export interface OrganizationContextResponse {
  organization: OrganizationResponse | null;
  user: UserResponse | null;
  subscription: {
    package_id: string;
    package_name: string;
    status: string;
    features: Record<string, unknown>;
  } | null;
  permissions: string[];
}

// ============================================================================
// Project Responses
// ============================================================================

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  status: string;
  owner_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectTaskResponse {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  phase_number: number | null;
  project_id: string;
  assignee_id: string | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhaseResponse {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string | null;
  display_order: number;
  data: Record<string, unknown>;
  completed: boolean;
}

// ============================================================================
// Dashboard Responses
// ============================================================================

export interface DashboardResponse {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  layout: Record<string, unknown> | null;
  widgets?: DashboardWidgetResponse[];
}

export interface DashboardWidgetResponse {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string | null;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
}

export interface WidgetDataResponse {
  widget_id: string;
  data: unknown;
  error?: string;
}

// ============================================================================
// Analytics Responses
// ============================================================================

export interface AnalyticsStatsResponse {
  total_views: number;
  total_searches: number;
  total_ai_queries?: number;
  helpful_ratings?: number;
  unhelpful_ratings?: number;
  top_articles?: Array<{
    article_id: string;
    article_title: string;
    views: number;
  }>;
  search_queries?: Array<{
    query: string;
    count: number;
  }>;
}

export interface AIUsageStatsResponse {
  total_usage: number;
  by_organization: Array<{
    organization_id: string;
    organization_name: string;
    usage_count: number;
  }>;
  by_action_type: Array<{
    action_type: string;
    count: number;
  }>;
}

// ============================================================================
// KB (Knowledge Base) Responses
// ============================================================================

export interface KBArticleResponse {
  id: string;
  title: string;
  slug: string;
  content: string;
  category_id: string | null;
  status: string;
  published_at: string | null;
  metadata?: Record<string, unknown>;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  author?: {
    id: string;
    name: string | null;
  } | null;
}

export interface KBCategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  order_index: number;
  articles_count?: number;
}

export interface KBSearchResponse {
  results: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    score: number;
    category?: {
      id: string;
      name: string;
    };
  }>;
  total: number;
}

// ============================================================================
// Team Responses
// ============================================================================

export interface TeamResponse {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  members?: Array<{
    id: string;
    user_id: string;
    role: string;
    user?: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
}

export interface TeamBoardResponse {
  team: TeamResponse;
  columns: Array<{
    id: string;
    name: string;
    tasks: ProjectTaskResponse[];
  }>;
}

// ============================================================================
// SOW (Statement of Work) Responses
// ============================================================================

export interface SOWResponse {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  members?: SOWMemberResponse[];
}

export interface SOWMemberResponse {
  id: string;
  sow_id: string;
  user_id: string;
  role: string | null;
  allocation_percentage: number | null;
  hourly_rate: number | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  workload?: {
    total_hours: number;
    allocated_hours: number;
    available_hours: number;
  };
}

export interface SOWMemberStatsResponse {
  member_id: string;
  user_id: string;
  user_name: string | null;
  total_hours: number;
  completed_hours: number;
  remaining_hours: number;
  utilization_percentage: number;
}

// ============================================================================
// Resource Allocation Responses
// ============================================================================

export interface ResourceAllocationResponse {
  id: string;
  user_id: string;
  project_id: string;
  sow_id: string | null;
  start_date: string;
  end_date: string;
  allocation_percentage: number;
  notes: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export interface WorkloadSummaryResponse {
  user_id: string;
  total_hours: number;
  allocated_hours: number;
  available_hours: number;
  projects_count: number;
  upcoming_deadlines: number;
  allocations: ResourceAllocationResponse[];
}

// ============================================================================
// Ops Responses
// ============================================================================

export interface CompanyResponse {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  organization_id: string;
  contacts_count?: number;
  opportunities_count?: number;
}

export interface ContactResponse {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  company?: {
    id: string;
    name: string;
  } | null;
}

export interface OpportunityResponse {
  id: string;
  name: string;
  value: number | null;
  status: string;
  source: string | null;
  company_id: string | null;
  company?: {
    id: string;
    name: string;
  } | null;
}

// ============================================================================
// Invoice Responses
// ============================================================================

export interface InvoiceResponse {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  company?: {
    id: string;
    name: string;
  } | null;
  line_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

// ============================================================================
// Subscription/Package Responses
// ============================================================================

export interface PackageResponse {
  id: string;
  name: string;
  description: string | null;
  price_per_user_monthly: number | null;
  price_per_user_yearly: number | null;
  features: Record<string, unknown>;
  is_active: boolean;
}

export interface SubscriptionResponse {
  id: string;
  organization_id: string;
  package_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  package?: PackageResponse;
}

// ============================================================================
// Template Responses
// ============================================================================

export interface TemplateResponse {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  is_public: boolean;
  schema: Record<string, unknown>;
  phases?: Array<{
    phase_number: number;
    phase_name: string;
    fields: Record<string, unknown>[];
  }>;
}

// ============================================================================
// Notification Responses
// ============================================================================

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  unread_count: number;
}

// ============================================================================
// Request Responses (Feature/Bug)
// ============================================================================

export interface RequestResponse {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  assigned_user?: {
    id: string;
    name: string | null;
  } | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Affiliate Responses
// ============================================================================

export interface AffiliateResponse {
  id: string;
  user_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  commission_rate: number;
  status: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  referrals_count?: number;
  total_commission?: number;
}

export interface AffiliateStatsResponse {
  total_referrals: number;
  successful_referrals: number;
  pending_commission: number;
  paid_commission: number;
  conversion_rate: number;
}

