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
  tags: string[];
  notes: string | null;
  dependencies: string[];
  ai_generated: boolean;
  ai_analysis_id: string | null;
  parent_task_id: string | null;
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

export type NotificationType = 'task_assigned' | 'comment_created' | 'comment_mention' | 'project_created' | 'project_member_added';

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

