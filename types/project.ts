import type { PhaseData, PhaseMetadata } from './phases';

export type ProjectStatus = 'idea' | 'in_progress' | 'blueprint_ready' | 'archived';
export type UserRole = 'admin' | 'pm' | 'designer' | 'engineer';
export type PrimaryTool = 'cursor' | 'replit' | 'lovable' | 'base44' | 'other';

export interface User {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organization_id?: string | null;
  bio?: string | null;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  phone?: string | null;
  website?: string | null;
  avatar_url?: string | null;
  github_username?: string | null;
  github_access_token?: string | null; // Encrypted
  preferences?: UserPreferences | null;
  is_active?: boolean;
  is_super_admin?: boolean; // Super admin users cannot be deleted
  is_company_admin?: boolean; // Company admin (organization admin, not super admin)
  is_affiliate?: boolean; // Whether user is an approved affiliate partner
  last_active_at?: string | null;
  invited_by_admin?: boolean;
  invite_created_at?: string | null;
  invite_created_by?: string | null;
  created_at: string;
}

export interface UserPreferences {
  notifications?: {
    email?: boolean;
    inApp?: boolean;
    push?: boolean; // Browser push notifications
  };
  theme?: {
    mode?: 'light' | 'dark';
  };
  ai?: {
    enabled?: boolean;
    model?: string;
  };
  sidebar?: {
    defaultOpen?: boolean; // Default sidebar state (true = open, false = collapsed)
  };
  onboarding?: {
    completed: boolean;
    completedSteps: string[]; // ['profile', 'preferences', 'company', 'contact', 'invite']
    skippedAt?: string; // ISO timestamp if fully skipped
    completedAt?: string; // ISO timestamp when finished
  };
}

export interface AdminSetting {
  id: string;
  key: string;
  value: any; // JSONB
  category: 'theme' | 'api' | 'system' | 'email';
  description?: string | null;
  updated_at: string;
  updated_by?: string | null;
  created_at: string;
}

export interface AIUsageMetadata {
  // Existing fields (backward compatible)
  structured?: boolean;
  prompt_length?: number;
  has_context?: boolean;
  has_phase_data?: boolean;
  
  // Enhanced tracking fields
  full_prompt_length?: number;
  response_length?: number;
  model?: string;
  response_time_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  error?: string;
  error_type?: string;
  feature_type?: string; // 'ai_generate', 'project_analyze', 'tasks_generated', etc.
  
  // Additional context fields
  analysis_type?: string;
  tasks_generated?: number;
  is_default_template?: boolean;
  count?: number;
  source?: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string | null;
  action_type: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: AIUsageMetadata | any; // JSONB - can be AIUsageMetadata or other metadata
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  primary_tool: PrimaryTool | null;
  initiated_at: string | null;
  initiated_by: string | null;
  company_id?: string | null; // Ops Tool: Company this project belongs to
  source?: 'Manual' | 'Converted'; // Ops Tool: How project was created
  opportunity_id?: string | null; // Ops Tool: Opportunity this project was converted from
  created_at: string;
  updated_at: string;
}

export interface ProjectWithPhases extends Project {
  phases: PhaseSummary[];
}

export interface ProjectPhaseRow {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string;
  display_order: number;
  data: any;
  completed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhaseSummary {
  phase_number: number;
  phase_name: string;
  display_order: number;
  completed: boolean;
  updated_at: string;
  data?: any; // Phase data for progress calculation
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_public: boolean; // Visible to all organization members
  is_publicly_available: boolean; // Available to public (outside organization)
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplatePhase {
  id: string;
  template_id: string;
  phase_number: number;
  phase_name: string;
  display_order: number;
  is_active: boolean;
  data: PhaseData;
  created_at: string;
}

export interface Export {
  id: string;
  project_id: string;
  export_type: 'blueprint_bundle' | 'cursor_bundle' | 'prd' | string;
  storage_path: string | null;
  user_id?: string | null;
  file_size?: number | null;
  created_at: string;
}

export interface ExportWithProject extends Export {
  project?: {
    name: string;
    description: string | null;
  };
}

export interface ExportWithUser extends Export {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ExportListResponse {
  exports: ExportWithUser[];
  total: number;
  limit: number;
  offset: number;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Reference to a phase field that generated a task
 * Used for smart re-analysis - tracks which phase data spawned each task
 */
export interface TaskSourceReference {
  phase_number: number;
  field_key: string;
  field_hash?: string; // Short hash of field value for change detection
}

export interface ProjectTask {
  id: string;
  project_id: string;
  phase_number: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null; // Estimated hours to complete this task
  tags: string[];
  notes: string | null;
  dependencies: string[];
  ai_generated: boolean;
  ai_analysis_id: string | null;
  parent_task_id: string | null;
  /**
   * Links task to originating phase fields for smart re-analysis
   * When source fields change, the task can be intelligently updated
   */
  source_reference?: TaskSourceReference[] | null;
  created_at: string;
  updated_at: string;
  // Optional field for nested loading (not in database, for UI convenience)
  subtasks?: ProjectTask[];
}

export interface ProjectTaskWithAssignee extends ProjectTask {
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// Extended task type that includes assignee info from API
export interface ProjectTaskExtended extends Omit<ProjectTask, 'assignee_id'> {
  assignee_id: string | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
  parent_task?: {
    id: string;
    title: string;
    assignee_id: string | null;
  } | null;
}

export interface ProjectAnalysis {
  id: string;
  project_id: string;
  analysis_type: 'initial' | 'update';
  summary: string | null;
  next_steps: string[];
  blockers: string[];
  estimates: {
    total_tasks?: number;
    estimated_hours?: number;
    estimated_days?: number;
    [key: string]: any;
  };
  tasks_generated: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
}

export type NotificationType = 'task_assigned' | 'comment_created' | 'comment_mention' | 'project_created' | 'project_member_added' | 'kb_article_published' | 'kb_article_updated' | 'kb_category_added' | 'kb_release_notes_published';

export interface NotificationMetadata {
  task_id?: string;
  project_id?: string;
  comment_id?: string;
  assigner_id?: string;
  assigner_name?: string;
  task_title?: string;
  project_name?: string;
  comment_preview?: string;
  added_by_id?: string;
  added_by_name?: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  read_at: string | null;
  metadata: NotificationMetadata;
  created_at: string;
}

// ============================================
// SCOPE OF WORK (SOW) TYPES
// ============================================

export type SOWStatus = 'draft' | 'review' | 'approved' | 'active' | 'completed' | 'archived';

export interface SOWTimeline {
  start_date: string;
  end_date: string;
  milestones?: Array<{
    name: string;
    date: string;
    description?: string;
  }>;
}

export interface SOWBudget {
  estimated_hours?: number;
  hourly_rate?: number;
  total_budget?: number;
  currency?: string;
}

export interface ScopeOfWork {
  id: string;
  project_id: string | null; // Nullable for opportunity-based SOWs
  opportunity_id: string | null; // Nullable for project-based SOWs
  version: number;
  title: string;
  description: string | null;
  objectives: string[];
  deliverables: string[];
  timeline: SOWTimeline;
  budget: SOWBudget;
  assumptions: string[];
  constraints: string[];
  exclusions: string[];
  acceptance_criteria: string[];
  status: SOWStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SOWResourceAllocation {
  id: string;
  sow_id: string;
  user_id: string;
  role: UserRole;
  allocated_hours_per_week: number;
  allocated_percentage: number | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SOWProjectMember {
  id: string;
  sow_id: string;
  project_member_id: string;
  organization_role_id: string; // References organization_roles.id
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  project_member?: {
    id: string;
    user_id: string;
    role: UserRole; // Legacy role from project_members (fallback)
    user?: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  organization_role?: {
    id: string;
    name: string;
    description: string | null;
    organization_id: string;
  } | null; // Can be null if no org role assigned
}

export interface SOWMemberWithStats extends SOWProjectMember {
  task_count: number;
  task_count_by_status: {
    todo: number;
    in_progress: number;
    done: number;
  };
  workload_summary?: UserWorkloadSummary;
  is_overworked?: boolean;
  // Computed fields for convenience
  role_name: string; // organization_role.name or project_member.role (fallback)
  role_description: string | null; // organization_role.description or null
}

export interface SOWWithAllocations extends ScopeOfWork {
  resource_allocations?: SOWResourceAllocation[];
  project_members?: SOWMemberWithStats[]; // NEW
}

// ============================================
// RESOURCE ALLOCATION TYPES
// ============================================

export interface UserCapacity {
  id: string;
  user_id: string;
  default_hours_per_week: number;
  max_hours_per_week: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberAllocation {
  id: string;
  project_id: string;
  user_id: string;
  allocated_hours_per_week: number;
  start_date: string | null; // Optional - NULL means ongoing allocation
  end_date: string | null; // Optional - NULL means ongoing allocation
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWorkloadSummary {
  user_id: string;
  max_hours_per_week: number;
  default_hours_per_week: number;
  allocated_hours_per_week: number;
  available_hours_per_week: number;
  utilization_percentage: number;
  is_over_allocated: boolean;
  start_date: string;
  end_date: string;
  projects?: Array<{
    project_id: string;
    project_name: string;
    allocated_hours_per_week: number;
    start_date: string;
    end_date: string;
  }>;
}

export interface ResourceAllocationConflict {
  user_id: string;
  user_name: string;
  conflict_type: 'over_allocated' | 'date_overlap' | 'exceeds_capacity';
  message: string;
  current_allocation: number;
  max_capacity: number;
  conflicting_projects?: Array<{
    project_id: string;
    project_name: string;
    allocated_hours: number;
  }>;
}

// ============================================
// TEAMS TYPES
// ============================================

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  member_count: number;
}

