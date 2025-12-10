/**
 * Workflow Validation Schemas
 * Provides Zod schemas for validating workflow configurations
 */

import { z } from 'zod';
import type { TriggerType, StepType, ActionType, ConditionOperator } from '@/types/workflows';

// ============================================
// TRIGGER CONFIG SCHEMAS
// ============================================

const eventTriggerConfigSchema = z.object({
  event_types: z.array(z.string()).min(1, 'At least one event type is required'),
  entity_type: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

const scheduleTriggerConfigSchema = z.object({
  schedule_type: z.enum(['daily', 'weekly', 'monthly', 'cron']),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
});

const webhookTriggerConfigSchema = z.object({
  secret: z.string().optional(),
  allowed_ips: z.array(z.string()).optional(),
});

const manualTriggerConfigSchema = z.object({
  description: z.string().optional(),
});

// ============================================
// ACTION CONFIG SCHEMAS
// ============================================

const sendEmailConfigSchema = z.object({
  to: z.string().min(1, 'Recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  body_html: z.string().min(1, 'Body is required'),
  body_text: z.string().optional(),
  from_name: z.string().optional(),
});

const sendNotificationConfigSchema = z.object({
  user_id: z.string().optional(),
  user_field: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.user_id || data.user_field,
  { message: 'Either user_id or user_field must be provided' }
);

const createTaskConfigSchema = z.object({
  project_id: z.string().optional(),
  project_field: z.string().optional(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignee_field: z.string().optional(),
  due_date_offset_days: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
}).refine(
  (data) => data.project_id || data.project_field,
  { message: 'Either project_id or project_field must be provided' }
);

const updateTaskConfigSchema = z.object({
  task_id: z.string().optional(),
  task_field: z.string().optional(),
  updates: z.object({
    status: z.enum(['todo', 'in_progress', 'done', 'archived']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assignee_id: z.string().nullable().optional(),
    assignee_field: z.string().optional(),
    due_date: z.string().optional(),
    due_date_offset_days: z.number().int().optional(),
  }),
}).refine(
  (data) => data.task_id || data.task_field,
  { message: 'Either task_id or task_field must be provided' }
);

const updateContactConfigSchema = z.object({
  contact_id: z.string().optional(),
  contact_field: z.string().optional(),
  updates: z.record(z.unknown()),
}).refine(
  (data) => data.contact_id || data.contact_field,
  { message: 'Either contact_id or contact_field must be provided' }
);

const tagConfigSchema = z.object({
  entity_type: z.enum(['contact', 'company']),
  entity_field: z.string().min(1, 'Entity field is required'),
  tag_name: z.string().min(1, 'Tag name is required'),
});

const aiGenerateConfigSchema = z.object({
  prompt_template: z.string().min(1, 'Prompt template is required'),
  output_field: z.string().min(1, 'Output field is required'),
  structured: z.boolean().optional(),
});

const aiCategorizeConfigSchema = z.object({
  field_to_analyze: z.string().min(1, 'Field to analyze is required'),
  categories: z.array(z.string()).min(2, 'At least 2 categories are required'),
  output_field: z.string().min(1, 'Output field is required'),
});

const webhookCallConfigSchema = z.object({
  url: z.string().url('Invalid URL format'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body_template: z.string().optional(),
  output_field: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
});

const createActivityConfigSchema = z.object({
  company_id: z.string().optional(),
  company_field: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  entity_type: z.string(),
  entity_field: z.string().optional(),
  event_type: z.string(),
});

// ============================================
// CONTROL FLOW CONFIG SCHEMAS
// ============================================

const conditionOperators: ConditionOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'gt', 'gte', 'lt', 'lte',
  'is_empty', 'is_not_empty', 'in', 'not_in'
];

const conditionConfigSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum(conditionOperators as [ConditionOperator, ...ConditionOperator[]]),
  value: z.unknown().optional(),
});

const delayConfigSchema = z.object({
  delay_type: z.enum(['minutes', 'hours', 'days']),
  delay_value: z.number().int().min(1, 'Delay value must be at least 1'),
});

const loopConfigSchema = z.object({
  collection_field: z.string().min(1, 'Collection field is required'),
  item_variable: z.string().min(1, 'Item variable name is required'),
  max_iterations: z.number().int().min(1).max(1000).optional(),
});

// ============================================
// STEP SCHEMA
// ============================================

const actionTypes: ActionType[] = [
  'send_email', 'send_notification', 'send_push',
  'create_task', 'update_task', 'bulk_update_tasks',
  'create_contact', 'update_contact', 'add_tag', 'remove_tag',
  'update_opportunity', 'create_project_from_opportunity',
  'create_project', 'create_project_from_template',
  'ai_generate', 'ai_categorize', 'ai_summarize',
  'webhook_call', 'create_activity'
];

const stepTypes: StepType[] = ['action', 'condition', 'delay', 'loop'];

export const workflowStepInputSchema = z.object({
  step_type: z.enum(stepTypes as [StepType, ...StepType[]]),
  action_type: z.enum(actionTypes as [ActionType, ...ActionType[]]).optional(),
  config: z.record(z.unknown()),
  else_goto_step: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    // Action steps must have an action_type
    if (data.step_type === 'action' && !data.action_type) {
      return false;
    }
    return true;
  },
  { message: 'Action steps must have an action_type' }
);

// ============================================
// WORKFLOW SCHEMAS
// ============================================

const triggerTypes: TriggerType[] = ['event', 'schedule', 'manual', 'webhook'];

export const createWorkflowInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  trigger_type: z.enum(triggerTypes as [TriggerType, ...TriggerType[]]),
  trigger_config: z.record(z.unknown()),
  steps: z.array(workflowStepInputSchema).optional(),
});

export const updateWorkflowInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long').optional(),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
  trigger_type: z.enum(triggerTypes as [TriggerType, ...TriggerType[]]).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
  steps: z.array(workflowStepInputSchema).optional(),
});

export const testWorkflowInputSchema = z.object({
  test_data: z.record(z.unknown()).optional(),
});

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate trigger configuration based on trigger type
 */
export function validateTriggerConfig(
  triggerType: TriggerType,
  config: unknown
): { valid: boolean; errors?: string[] } {
  try {
    switch (triggerType) {
      case 'event':
        eventTriggerConfigSchema.parse(config);
        break;
      case 'schedule':
        scheduleTriggerConfigSchema.parse(config);
        break;
      case 'webhook':
        webhookTriggerConfigSchema.parse(config);
        break;
      case 'manual':
        manualTriggerConfigSchema.parse(config);
        break;
      default:
        return { valid: false, errors: [`Unknown trigger type: ${triggerType}`] };
    }
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate step configuration based on step type and action type
 */
export function validateStepConfig(
  stepType: StepType,
  actionType: ActionType | null | undefined,
  config: unknown
): { valid: boolean; errors?: string[] } {
  try {
    switch (stepType) {
      case 'condition':
        conditionConfigSchema.parse(config);
        break;
      case 'delay':
        delayConfigSchema.parse(config);
        break;
      case 'loop':
        loopConfigSchema.parse(config);
        break;
      case 'action':
        if (!actionType) {
          return { valid: false, errors: ['Action type is required for action steps'] };
        }
        return validateActionConfig(actionType, config);
      default:
        return { valid: false, errors: [`Unknown step type: ${stepType}`] };
    }
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate action configuration based on action type
 */
export function validateActionConfig(
  actionType: ActionType,
  config: unknown
): { valid: boolean; errors?: string[] } {
  try {
    switch (actionType) {
      case 'send_email':
        sendEmailConfigSchema.parse(config);
        break;
      case 'send_notification':
      case 'send_push':
        sendNotificationConfigSchema.parse(config);
        break;
      case 'create_task':
        createTaskConfigSchema.parse(config);
        break;
      case 'update_task':
        updateTaskConfigSchema.parse(config);
        break;
      case 'update_contact':
        updateContactConfigSchema.parse(config);
        break;
      case 'add_tag':
      case 'remove_tag':
        tagConfigSchema.parse(config);
        break;
      case 'ai_generate':
        aiGenerateConfigSchema.parse(config);
        break;
      case 'ai_categorize':
        aiCategorizeConfigSchema.parse(config);
        break;
      case 'webhook_call':
        webhookCallConfigSchema.parse(config);
        break;
      case 'create_activity':
        createActivityConfigSchema.parse(config);
        break;
      default:
        // For action types without specific validation, accept any config
        return { valid: true };
    }
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate an entire workflow including all steps
 */
export function validateWorkflow(
  workflow: unknown
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  // Validate basic structure
  const basicResult = createWorkflowInputSchema.safeParse(workflow);
  if (!basicResult.success) {
    return {
      valid: false,
      errors: basicResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
  
  const data = basicResult.data;
  
  // Validate trigger config
  const triggerResult = validateTriggerConfig(data.trigger_type, data.trigger_config);
  if (!triggerResult.valid && triggerResult.errors) {
    errors.push(...triggerResult.errors.map((e) => `trigger_config.${e}`));
  }
  
  // Validate each step
  if (data.steps) {
    data.steps.forEach((step, index) => {
      const stepResult = validateStepConfig(
        step.step_type,
        step.action_type,
        step.config
      );
      if (!stepResult.valid && stepResult.errors) {
        errors.push(...stepResult.errors.map((e) => `steps[${index}].${e}`));
      }
    });
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

