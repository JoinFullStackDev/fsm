/**
 * Workflow Automation Type Definitions
 * Provides strict TypeScript types for the workflow builder system
 */

import type { ActivityEventType, ActivityEntityType } from './ops';

// ============================================
// TRIGGER TYPES
// ============================================

export type TriggerType = 'event' | 'schedule' | 'manual' | 'webhook';

export interface EventTriggerConfig {
  /** Which event types trigger this workflow */
  event_types: ActivityEventType[];
  /** Optional: filter by entity type */
  entity_type?: ActivityEntityType;
  /** Field-based filters (e.g., { status: 'new' }) */
  filters?: Record<string, unknown>;
}

export interface ScheduleTriggerConfig {
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'cron';
  /** Time in HH:MM format for daily/weekly/monthly */
  time?: string;
  /** Day of week (0-6, Sunday = 0) for weekly schedules */
  day_of_week?: number;
  /** Day of month (1-31) for monthly schedules */
  day_of_month?: number;
  /** Cron expression for advanced scheduling */
  cron?: string;
  /** Timezone (e.g., 'America/New_York') */
  timezone?: string;
}

export interface WebhookTriggerConfig {
  /** Secret for signature verification */
  secret?: string;
  /** IP whitelist for additional security */
  allowed_ips?: string[];
}

export interface ManualTriggerConfig {
  /** Optional description for the manual trigger */
  description?: string;
}

export type TriggerConfig =
  | EventTriggerConfig
  | ScheduleTriggerConfig
  | WebhookTriggerConfig
  | ManualTriggerConfig;

// ============================================
// STEP & ACTION TYPES
// ============================================

export type StepType = 'action' | 'condition' | 'delay' | 'loop';

export type ActionType =
  // Communication
  | 'send_email'
  | 'send_notification'
  | 'send_push'
  // Tasks
  | 'create_task'
  | 'update_task'
  | 'bulk_update_tasks'
  // Contacts
  | 'create_contact'
  | 'update_contact'
  | 'add_tag'
  | 'remove_tag'
  // Opportunities
  | 'update_opportunity'
  | 'create_project_from_opportunity'
  // Projects
  | 'create_project'
  | 'create_project_from_template'
  // AI
  | 'ai_generate'
  | 'ai_categorize'
  | 'ai_summarize'
  // Integrations
  | 'webhook_call'
  | 'create_activity'
  | 'send_slack';

// ============================================
// ACTION CONFIGURATION TYPES
// ============================================

export interface SendEmailConfig {
  /** Recipient email or template variable like {{contact.email}} */
  to: string;
  /** Email subject (supports template variables) */
  subject: string;
  /** HTML body content (supports template variables) */
  body_html: string;
  /** Optional plain text body */
  body_text?: string;
  /** Optional sender name override */
  from_name?: string;
}

export interface SendNotificationConfig {
  /** Specific user ID to notify */
  user_id?: string;
  /** Field in context containing user_id (e.g., 'task.assignee_id') */
  user_field?: string;
  /** Notification title (supports template variables) */
  title: string;
  /** Notification message (supports template variables) */
  message: string;
  /** Notification type for categorization */
  type?: string;
  /** Additional metadata for the notification */
  metadata?: Record<string, unknown>;
}

export interface CreateTaskConfig {
  /** Specific project ID */
  project_id?: string;
  /** Field in context containing project_id */
  project_field?: string;
  /** Task title (supports template variables) */
  title: string;
  /** Task description (supports template variables) */
  description?: string;
  /** Initial task status */
  status?: 'todo' | 'in_progress' | 'done';
  /** Task priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Field containing assignee user_id */
  assignee_field?: string;
  /** Due date as days from now */
  due_date_offset_days?: number;
  /** Tags to apply to the task */
  tags?: string[];
}

export interface UpdateTaskConfig {
  /** Specific task ID */
  task_id?: string;
  /** Field in context containing task_id */
  task_field?: string;
  /** Fields to update */
  updates: {
    status?: 'todo' | 'in_progress' | 'done' | 'archived';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assignee_id?: string | null;
    assignee_field?: string;
    due_date?: string;
    due_date_offset_days?: number;
  };
}

export interface BulkUpdateTasksConfig {
  /** Field containing array of task IDs */
  task_ids_field: string;
  /** Update operation */
  operation: 'status' | 'priority' | 'reassign';
  /** Value for the operation */
  value: string;
}

export interface CreateContactConfig {
  /** Company ID for the contact */
  company_id?: string;
  /** Field containing company_id */
  company_field?: string;
  /** Contact first name (supports template variables) */
  first_name: string;
  /** Contact last name (supports template variables) */
  last_name: string;
  /** Contact email (supports template variables) */
  email?: string;
  /** Additional fields to set */
  additional_fields?: Record<string, unknown>;
}

export interface UpdateContactConfig {
  /** Specific contact ID */
  contact_id?: string;
  /** Field in context containing contact_id */
  contact_field?: string;
  /** Fields to update (supports template variables in values) */
  updates: Record<string, unknown>;
}

export interface TagConfig {
  /** Entity type to tag */
  entity_type: 'contact' | 'company';
  /** Field containing the entity ID */
  entity_field: string;
  /** Tag name to add/remove (supports template variables) */
  tag_name: string;
}

export interface UpdateOpportunityConfig {
  /** Specific opportunity ID */
  opportunity_id?: string;
  /** Field containing opportunity_id */
  opportunity_field?: string;
  /** Fields to update */
  updates: Record<string, unknown>;
}

export interface CreateProjectConfig {
  /** Project name (supports template variables) */
  name: string;
  /** Project description (supports template variables) */
  description?: string;
  /** Company ID to link */
  company_id?: string;
  /** Field containing company_id */
  company_field?: string;
  /** Template ID to create from */
  template_id?: string;
}

export interface AIGenerateConfig {
  /** Prompt template with {{variables}} */
  prompt_template: string;
  /** Field name to store the result in context */
  output_field: string;
  /** Whether to expect structured JSON output */
  structured?: boolean;
}

export interface AICategorizeConfig {
  /** Field path to analyze (e.g., 'contact.notes') */
  field_to_analyze: string;
  /** Possible categories to classify into */
  categories: string[];
  /** Field name to store the result */
  output_field: string;
}

export interface AISummarizeConfig {
  /** Field path to summarize */
  field_to_summarize: string;
  /** Maximum length of summary */
  max_length?: number;
  /** Field name to store the result */
  output_field: string;
}

export interface WebhookCallConfig {
  /** URL to call (supports template variables) */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Custom headers */
  headers?: Record<string, string>;
  /** JSON body template (supports template variables) */
  body_template?: string;
  /** Field to store response data */
  output_field?: string;
  /** Timeout in milliseconds */
  timeout_ms?: number;
}

export interface CreateActivityConfig {
  /** Company ID for the activity */
  company_id?: string;
  /** Field containing company_id */
  company_field?: string;
  /** Activity message (supports template variables) */
  message: string;
  /** Related entity type */
  entity_type: ActivityEntityType;
  /** Field containing entity ID */
  entity_field?: string;
  /** Event type for the activity */
  event_type: ActivityEventType;
}

export interface SendSlackConfig {
  /** Channel ID or name (e.g., '#general' or 'C1234567890') - supports template variables */
  channel: string;
  /** Message text (supports template variables) */
  message: string;
  /** Optional: send as blocks for rich formatting */
  use_blocks?: boolean;
  /** Optional: mention @channel or @here */
  notify_channel?: boolean;
  /** Optional: custom username for the bot */
  username?: string;
  /** Optional: custom icon emoji for the bot */
  icon_emoji?: string;
}

// ============================================
// CONTROL FLOW CONFIGURATION TYPES
// ============================================

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in';

export interface ConditionConfig {
  /** Field path in context to evaluate */
  field: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against (not needed for is_empty/is_not_empty) */
  value?: unknown;
}

export interface DelayConfig {
  /** Unit of delay */
  delay_type: 'minutes' | 'hours' | 'days';
  /** Amount to delay */
  delay_value: number;
}

export interface LoopConfig {
  /** Field containing the array to iterate */
  collection_field: string;
  /** Variable name for the current item in each iteration */
  item_variable: string;
  /** Safety limit on iterations */
  max_iterations?: number;
}

// ============================================
// UNION TYPE FOR ALL STEP CONFIGS
// ============================================

export type StepConfig =
  | SendEmailConfig
  | SendNotificationConfig
  | CreateTaskConfig
  | UpdateTaskConfig
  | BulkUpdateTasksConfig
  | CreateContactConfig
  | UpdateContactConfig
  | TagConfig
  | UpdateOpportunityConfig
  | CreateProjectConfig
  | AIGenerateConfig
  | AICategorizeConfig
  | AISummarizeConfig
  | WebhookCallConfig
  | CreateActivityConfig
  | SendSlackConfig
  | ConditionConfig
  | DelayConfig
  | LoopConfig;

// ============================================
// WORKFLOW ENTITIES
// ============================================

export interface Workflow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  step_type: StepType;
  action_type: ActionType | null;
  config: StepConfig;
  else_goto_step: number | null;
  created_at: string;
}

export interface WorkflowWithSteps extends Workflow {
  steps: WorkflowStep[];
}

export type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface WorkflowRun {
  id: string;
  workflow_id: string | null;
  workflow_name: string;
  organization_id: string;
  trigger_type: TriggerType;
  trigger_data: Record<string, unknown>;
  status: WorkflowRunStatus;
  current_step: number;
  context: WorkflowContext;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface WorkflowRunStep {
  id: string;
  run_id: string;
  step_id: string | null;
  step_order: number;
  step_type: StepType;
  action_type: ActionType | null;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowScheduledStep {
  id: string;
  run_id: string;
  step_order: number;
  execute_at: string;
  context: WorkflowContext;
  status: 'pending' | 'executed' | 'cancelled';
  created_at: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  steps: WorkflowStepInput[];
  is_global: boolean;
  organization_id: string | null;
  created_at: string;
}

// ============================================
// WORKFLOW EXECUTION CONTEXT
// ============================================

export interface WorkflowContext {
  /** Information about what triggered the workflow */
  trigger: {
    type: TriggerType;
    event_type?: ActivityEventType;
    entity_type?: ActivityEntityType;
    entity_id?: string;
    data?: Record<string, unknown>;
  };

  /** Entity snapshots at trigger time */
  contact?: Record<string, unknown>;
  opportunity?: Record<string, unknown>;
  task?: Record<string, unknown>;
  project?: Record<string, unknown>;
  company?: Record<string, unknown>;

  /** Outputs from each step (keyed by step_order) */
  steps: Record<number, unknown>;

  /** Organization context */
  organization_id: string;
  
  /** User who triggered (if applicable) */
  triggered_by_user_id?: string;
  
  /** Timestamp of trigger */
  triggered_at: string;

  /** Loop iteration data (when inside a loop) */
  loop?: {
    index: number;
    item: unknown;
    collection_length: number;
  };
}

// ============================================
// INPUT TYPES (for API requests)
// ============================================

export interface WorkflowStepInput {
  step_type: StepType;
  action_type?: ActionType;
  config: StepConfig | Record<string, unknown>;
  else_goto_step?: number;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  steps?: WorkflowStepInput[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  trigger_type?: TriggerType;
  trigger_config?: TriggerConfig;
  is_active?: boolean;
  steps?: WorkflowStepInput[];
}

export interface TestWorkflowInput {
  test_data?: Record<string, unknown>;
}

// ============================================
// STEP EXECUTION RESULT
// ============================================

export interface StepExecutionResult {
  status: 'success' | 'failed' | 'skipped' | 'paused';
  output?: unknown;
  error?: string;
  /** For condition steps: which step to execute next */
  nextStepOrder?: number;
  /** For delay steps: workflow is paused */
  paused?: boolean;
}

// ============================================
// ACTION EXECUTOR TYPE
// ============================================

export type ActionExecutor = (
  config: StepConfig,
  context: WorkflowContext
) => Promise<{ output: unknown }>;

// ============================================
// WORKFLOW EVENT PAYLOAD
// ============================================

export interface WorkflowEventPayload {
  event_type: ActivityEventType;
  entity_type: ActivityEntityType;
  entity_id: string;
  entity_data: Record<string, unknown>;
  organization_id: string;
  user_id?: string;
}

