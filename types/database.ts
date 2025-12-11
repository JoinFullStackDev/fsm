/**
 * Database row types for Supabase queries
 * These types represent the shape of data returned from the database
 * Use these instead of 'any' when working with Supabase query results
 */

// ============================================================================
// Users Table
// ============================================================================

export interface UserRow {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
  organization_id: string | null;
  role: string;
  bio: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  phone: string | null;
  website: string | null;
  avatar_url: string | null;
  github_username: string | null;
  github_access_token: string | null;
  preferences: Record<string, unknown> | null;
  is_active: boolean;
  is_super_admin: boolean;
  is_company_admin: boolean;
  is_affiliate: boolean;
  last_active_at: string | null;
  invited_by_admin: boolean;
  invite_created_at: string | null;
  invite_created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRowPartial = Partial<UserRow> & Pick<UserRow, 'id'>;

// ============================================================================
// Organizations Table
// ============================================================================

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown> | null;
  branding: Record<string, unknown> | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  module_overrides?: Record<string, boolean> | null;
}

export type OrganizationRowPartial = Partial<OrganizationRow> & Pick<OrganizationRow, 'id'>;

// ============================================================================
// Projects Table
// ============================================================================

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  owner_id: string | null;
  organization_id: string;
  company_id: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectRowPartial = Partial<ProjectRow> & Pick<ProjectRow, 'id'>;

// ============================================================================
// Project Tasks Table
// ============================================================================

export interface ProjectTaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  phase_number: number | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectTaskRowPartial = Partial<ProjectTaskRow> & Pick<ProjectTaskRow, 'id'>;

// ============================================================================
// Project Phases Table
// ============================================================================

export interface ProjectPhaseRow {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string | null;
  display_order: number;
  data: Record<string, unknown>;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectPhaseRowPartial = Partial<ProjectPhaseRow> & Pick<ProjectPhaseRow, 'id'>;

// ============================================================================
// Project Members Table
// ============================================================================

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  organization_role_id: string | null;
  created_at: string;
}

// ============================================================================
// Activity Logs Table
// ============================================================================

export interface ActivityLogRow {
  id: string;
  user_id: string | null;
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Knowledge Base Tables
// ============================================================================

export interface KBArticleRow {
  id: string;
  title: string;
  slug: string;
  content: string;
  category_id: string | null;
  status: string;
  author_id: string | null;
  published_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface KBCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface KBAnalyticsRow {
  id: string;
  article_id: string | null;
  user_id: string | null;
  action_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Dashboard Tables
// ============================================================================

export interface DashboardRow {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_by: string;
  is_public: boolean;
  layout: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidgetRow {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string | null;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Company/Contact Tables (Ops)
// ============================================================================

export interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyContactRow {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityRow {
  id: string;
  name: string;
  value: number | null;
  status: string;
  source: string | null;
  company_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SOW (Statement of Work) Tables
// ============================================================================

export interface SOWRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  created_at: string;
  updated_at: string;
}

export interface SOWMemberRow {
  id: string;
  sow_id: string;
  user_id: string;
  role: string | null;
  allocation_percentage: number | null;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Resource Allocation Table
// ============================================================================

export interface ResourceAllocationRow {
  id: string;
  user_id: string;
  project_id: string;
  sow_id: string | null;
  start_date: string;
  end_date: string;
  allocation_percentage: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Subscription/Package Tables
// ============================================================================

export interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  price_per_user_monthly: number | null;
  price_per_user_yearly: number | null;
  features: Record<string, unknown> | null;
  is_active: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_yearly_price_id: string | null;
  pricing_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  organization_id: string;
  package_id: string;
  status: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_interval: string | null;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Team Tables
// ============================================================================

export interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

// ============================================================================
// Template Tables
// ============================================================================

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  is_public: boolean;
  schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Invoice Tables
// ============================================================================

export interface InvoiceRow {
  id: string;
  organization_id: string;
  company_id: string | null;
  invoice_number: string;
  status: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Notification Tables
// ============================================================================

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// API Keys Table
// ============================================================================

export interface ApiKeyRow {
  id: string;
  key_id: string;
  name: string;
  scope: string;
  organization_id: string | null;
  permissions: string;
  status: string;
  expires_at: string | null;
  last_used_at: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Affiliate Tables
// ============================================================================

export interface AffiliateRow {
  id: string;
  user_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  commission_rate: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AffiliateReferralRow {
  id: string;
  affiliate_id: string;
  referred_user_id: string | null;
  referred_organization_id: string | null;
  status: string;
  commission_amount: number | null;
  paid_at: string | null;
  created_at: string;
}

// ============================================================================
// Feature/Bug Request Tables
// ============================================================================

export interface FeatureBugRequestRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Organization Roles Table
// ============================================================================

export interface OrganizationRoleRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleAssignmentRow {
  id: string;
  user_id: string;
  role_id: string;
  organization_id: string;
  created_at: string;
}

// ============================================================================
// SOW Task & Member Types (for API routes)
// ============================================================================

/**
 * Task data from project_tasks query with limited fields
 */
export interface SOWTaskRow {
  assignee_id: string | null;
  status: string;
  estimated_hours: string | number | null;
  due_date: string | null;
}

/**
 * Project member allocation from project_member_allocations table
 */
export interface ProjectMemberAllocationRow {
  user_id: string;
  allocated_hours_per_week: number;
}

/**
 * SOW project member from sow_project_members with joined relations
 */
export interface SOWProjectMemberRow {
  id: string;
  sow_id: string;
  project_member_id: string;
  organization_role_id: string; // Required field - always set when adding SOW members
  notes: string | null;
  created_at: string;
  updated_at: string;
  project_member?: {
    id: string;
    user_id: string;
    role: string;
    user?: {
      id: string;
      name: string | null;
      email: string;
    };
  } | null;
  organization_role?: {
    id: string;
    name: string;
    description: string | null;
    organization_id: string;
  } | null;
}

/**
 * Workload result from RPC get_user_workload_summary
 */
export interface WorkloadRPCResult {
  userId: string;
  data: UserWorkloadSummary | null;
  error: unknown;
}

/**
 * Resource allocation input for creating SOW allocations
 */
export interface ResourceAllocationInput {
  user_id: string;
  role: string;
  allocated_hours_per_week: number;
  allocated_percentage?: number | null;
  start_date: string;
  end_date: string;
  notes?: string | null;
}

/**
 * SOW Update data with optional fields
 */
export interface SOWUpdateData {
  title?: string;
  description?: string | null;
  objectives?: string[];
  deliverables?: string[];
  timeline?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  assumptions?: string[];
  constraints?: string[];
  exclusions?: string[];
  acceptance_criteria?: string[];
  status?: string;
  approved_by?: string;
  approved_at?: string;
}

/**
 * SOW Member update data
 */
export interface SOWMemberUpdateData {
  organization_role_id?: string;
  notes?: string | null;
}

// ============================================================================
// Helper Types for Query Results
// ============================================================================

/**
 * Type for workload summary from RPC function
 */
export interface UserWorkloadSummary {
  total_hours: number;
  allocated_hours: number;
  available_hours: number;
  projects_count: number;
  upcoming_deadlines: number;
  is_over_allocated?: boolean;
}

/**
 * Type for analytics aggregation results
 */
export interface AnalyticsAggregation {
  count: number;
  label: string;
  value?: number;
}

// ============================================================================
// Dashboard Widget Types
// ============================================================================

/**
 * Date range object for queries
 */
export interface DateRangeFilter {
  start: string;
  end: string;
}

/**
 * Dashboard widget dataset configuration
 */
export interface WidgetDataset {
  dataSource?: string;
  source?: string;
  dataSources?: string[];
  filters?: {
    projectId?: string;
    status?: string | string[];
    assigneeId?: string;
    myTasks?: boolean;
    dueDateRange?: DateRangeFilter;
    dateRange?: DateRangeFilter;
    actionTypes?: string[];
  };
  groupBy?: string;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  insight_type?: string;
  content?: string;
  autoGenerate?: boolean;
  chartType?: 'line' | 'bar' | 'pie' | 'area';
}

/**
 * Dashboard widget settings
 */
export interface WidgetSettings {
  title?: string;
  cachedInsight?: string;
  chartType?: string;
  height?: number;
  [key: string]: unknown;
}

/**
 * Dashboard widget row with typed dataset
 */
export interface DashboardWidgetWithDataset extends DashboardWidgetRow {
  dataset: WidgetDataset;
  settings?: WidgetSettings;
}

/**
 * Metric widget data result
 */
export interface MetricWidgetData {
  value: number | string;
  label: string;
  change?: number;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Chart widget data result
 */
export interface ChartWidgetData {
  data: ChartDataPoint[];
  xAxis?: string;
  series?: Array<{
    key: string;
    label: string;
  }>;
}

/**
 * Table widget data result
 */
export interface TableWidgetData {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

/**
 * AI insight widget data
 */
export interface AIInsightWidgetData {
  type: 'ai_insight';
  insight?: string;
  insight_type: string;
  message?: string;
}

/**
 * Rich text widget data
 */
export interface RichTextWidgetData {
  type: 'rich_text';
  content: string;
}

/**
 * Union type for all widget data types
 */
export type WidgetData = 
  | MetricWidgetData 
  | ChartWidgetData 
  | TableWidgetData 
  | AIInsightWidgetData 
  | RichTextWidgetData 
  | null;

/**
 * Chart query options
 */
export interface ChartQueryOptions {
  projectId?: string;
  dateRange?: DateRangeFilter;
  groupBy?: 'day' | 'week' | 'month';
}

/**
 * Table query options
 */
export interface TableQueryOptions {
  projectId?: string;
  limit?: number;
  status?: string[];
  assigneeId?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  actionTypes?: string[];
}

/**
 * Dashboard insert/update data
 */
export interface DashboardInsertData {
  owner_id: string;
  name: string;
  description?: string | null;
  is_personal?: boolean;
  is_default?: boolean;
  organization_id?: string;
  project_id?: string | null;
  layout?: Record<string, unknown>;
}

/**
 * Dashboard update data (partial)
 */
export interface DashboardUpdateData {
  name?: string;
  description?: string | null;
  is_default?: boolean;
  layout?: Record<string, unknown>;
  updated_at?: string;
}

/**
 * Widget insert data
 */
export interface WidgetInsertData {
  dashboard_id: string;
  widget_type: string;
  position: Record<string, unknown>;
  dataset?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

/**
 * Widget update data
 */
export interface WidgetUpdateData {
  dataset?: Record<string, unknown>;
  position?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  updated_at?: string;
}

/**
 * Subscription update data
 */
export interface SubscriptionUpdateData {
  schedule_type?: string;
  email?: string;
  enabled?: boolean;
  updated_at?: string;
}

// ============================================================================
// AI Response Types
// ============================================================================

/**
 * AI usage metadata from generation calls
 */
export interface AIUsageMetadata {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  tokens_used?: number; // Alias for total_tokens in some contexts
  response_time_ms?: number;
  estimated_cost?: number;
  prompt_length?: number;
  response_length?: number;
  structured?: boolean;
  has_context?: boolean;
  has_phase_data?: boolean;
  error?: string;
  error_type?: string;
  feature_type?: string;
}

/**
 * Generic AI response wrapper with metadata
 */
export interface AIResponseWithMetadata<T = unknown> {
  result: T;
  metadata?: AIUsageMetadata;
}

/**
 * AI chat response type
 */
export interface AIChatResponse {
  text: string;
  metadata?: AIUsageMetadata;
}

/**
 * Generic query result type with common join patterns
 */
export interface UserWithOrganization extends UserRow {
  organization: OrganizationRow | null;
}

export interface ProjectWithOwner extends ProjectRow {
  owner: Pick<UserRow, 'id' | 'name' | 'email'> | null;
}

export interface TaskWithAssignee extends ProjectTaskRow {
  assignee: Pick<UserRow, 'id' | 'name' | 'email'> | null;
}

export interface TaskWithProject extends ProjectTaskRow {
  project: Pick<ProjectRow, 'id' | 'name' | 'organization_id'> | null;
}

// ============================================================================
// Dashboard Widget Query Results
// ============================================================================

/**
 * Task query result for dashboard widgets
 */
export interface DashboardTaskQueryResult {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
  phase_number: number | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    name: string;
  } | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

/**
 * Project query result for dashboard widgets
 */
export interface DashboardProjectQueryResult {
  id: string;
  name: string;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  organization_id: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

/**
 * Phase query result for dashboard widgets
 */
export interface DashboardPhaseQueryResult {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string | null;
  completed: boolean;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Opportunity query result for dashboard widgets
 */
export interface DashboardOpportunityQueryResult {
  id: string;
  name: string;
  value: number | null;
  status: string;
  source: string | null;
  company_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  company?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Company query result for dashboard widgets
 */
export interface DashboardCompanyQueryResult {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Activity log query result for dashboard widgets
 */
export interface DashboardActivityQueryResult {
  id: string;
  user_id: string | null;
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

/**
 * Export query result for dashboard widgets
 */
export interface DashboardExportQueryResult {
  id: string;
  project_id: string;
  export_type: string;
  storage_path: string | null;
  file_size: number | null;
  created_at: string;
  user_id: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

/**
 * Contact query result with company info
 */
export interface ContactWithCompanyQueryResult {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  lead_status: string | null;
  pipeline_stage: string | null;
  created_at: string;
  company?: {
    id: string;
    name: string;
  } | null;
}

