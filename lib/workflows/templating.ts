/**
 * Workflow Templating Utilities
 * Provides variable interpolation for workflow configurations
 * Uses Handlebars-style {{variable}} syntax
 */

import type { WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

// Match {{variable.path}} patterns
const TEMPLATE_REGEX = /\{\{([^{}]+)\}\}/g;

// Maximum template depth to prevent infinite recursion
const MAX_TEMPLATE_DEPTH = 10;

/**
 * Get a nested value from an object using dot notation
 * Supports array access with brackets: items[0].name
 * 
 * @param obj - Object to extract value from
 * @param path - Dot-notation path (e.g., 'contact.email' or 'items[0].name')
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  
  // Handle array bracket notation: convert items[0] to items.0
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  
  const keys = normalizedPath.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (typeof current !== 'object') {
      return undefined;
    }
    
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Set a nested value in an object using dot notation
 * Creates intermediate objects as needed
 * 
 * @param obj - Object to set value in
 * @param path - Dot-notation path
 * @param value - Value to set
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Interpolate template variables in a string
 * Replaces {{variable.path}} with values from context
 * 
 * @param template - String with template variables
 * @param context - Workflow context containing values
 * @param depth - Current recursion depth (for safety)
 * @returns Interpolated string
 */
export function interpolateTemplate(
  template: string,
  context: WorkflowContext | Record<string, unknown>,
  depth: number = 0
): string {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  // Prevent infinite recursion
  if (depth > MAX_TEMPLATE_DEPTH) {
    logger.warn('[Templating] Max template depth exceeded, returning as-is');
    return template;
  }
  
  let result = template;
  let match: RegExpExecArray | null;
  
  // Reset regex lastIndex
  TEMPLATE_REGEX.lastIndex = 0;
  
  while ((match = TEMPLATE_REGEX.exec(template)) !== null) {
    const fullMatch = match[0]; // {{variable.path}}
    const path = match[1].trim(); // variable.path
    
    const value = getNestedValue(context, path);
    
    let replacement: string;
    if (value === undefined || value === null) {
      // Keep original if value not found
      replacement = '';
    } else if (typeof value === 'object') {
      // Stringify objects
      replacement = JSON.stringify(value);
    } else {
      replacement = String(value);
    }
    
    result = result.replace(fullMatch, replacement);
  }
  
  // Check if result still contains templates (from nested values)
  if (TEMPLATE_REGEX.test(result) && result !== template) {
    return interpolateTemplate(result, context, depth + 1);
  }
  
  return result;
}

/**
 * Interpolate template variables in an object recursively
 * Handles strings, arrays, and nested objects
 * 
 * @param obj - Object with template variables
 * @param context - Workflow context containing values
 * @returns Object with interpolated values
 */
export function interpolateObject<T>(
  obj: T,
  context: WorkflowContext | Record<string, unknown>
): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return interpolateTemplate(obj, context) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context)) as T;
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Check if a string contains template variables
 * 
 * @param str - String to check
 * @returns true if string contains {{...}} patterns
 */
export function hasTemplateVariables(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  TEMPLATE_REGEX.lastIndex = 0;
  return TEMPLATE_REGEX.test(str);
}

/**
 * Extract all template variable paths from a string
 * 
 * @param str - String to extract from
 * @returns Array of variable paths
 */
export function extractTemplateVariables(str: string): string[] {
  if (!str || typeof str !== 'string') {
    return [];
  }
  
  const variables: string[] = [];
  let match: RegExpExecArray | null;
  
  // Reset regex lastIndex
  TEMPLATE_REGEX.lastIndex = 0;
  
  while ((match = TEMPLATE_REGEX.exec(str)) !== null) {
    const path = match[1].trim();
    if (!variables.includes(path)) {
      variables.push(path);
    }
  }
  
  return variables;
}

/**
 * Validate that all template variables in a config can be resolved
 * from the expected context structure
 * 
 * @param config - Configuration object to validate
 * @param availableFields - List of available field paths
 * @returns Object with valid flag and list of missing fields
 */
export function validateTemplateVariables(
  config: unknown,
  availableFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  function checkValue(value: unknown): void {
    if (typeof value === 'string') {
      const variables = extractTemplateVariables(value);
      for (const variable of variables) {
        // Check if variable path starts with any available field
        const isAvailable = availableFields.some(
          (field) => variable === field || variable.startsWith(`${field}.`)
        );
        if (!isAvailable && !missingFields.includes(variable)) {
          missingFields.push(variable);
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(checkValue);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(checkValue);
    }
  }
  
  checkValue(config);
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Standard available fields in workflow context
 */
export const STANDARD_CONTEXT_FIELDS = [
  'trigger',
  'trigger.type',
  'trigger.event_type',
  'trigger.entity_type',
  'trigger.entity_id',
  'trigger.data',
  'contact',
  'opportunity',
  'task',
  'project',
  'company',
  'steps',
  'organization_id',
  'triggered_by_user_id',
  'triggered_at',
  'loop',
  'loop.index',
  'loop.item',
  'loop.collection_length',
];

/**
 * Build context fields list based on entity type
 * 
 * @param entityType - Type of entity being processed
 * @returns List of available context field paths
 */
export function buildContextFieldsList(entityType?: string): string[] {
  const fields = [...STANDARD_CONTEXT_FIELDS];
  
  // Add entity-specific fields
  if (entityType === 'contact') {
    fields.push(
      'contact.id',
      'contact.first_name',
      'contact.last_name',
      'contact.email',
      'contact.phone',
      'contact.company_id',
      'contact.lead_status',
      'contact.pipeline_stage'
    );
  } else if (entityType === 'task') {
    fields.push(
      'task.id',
      'task.title',
      'task.description',
      'task.status',
      'task.priority',
      'task.assignee_id',
      'task.project_id',
      'task.due_date'
    );
  } else if (entityType === 'opportunity') {
    fields.push(
      'opportunity.id',
      'opportunity.name',
      'opportunity.value',
      'opportunity.status',
      'opportunity.company_id'
    );
  } else if (entityType === 'project') {
    fields.push(
      'project.id',
      'project.name',
      'project.description',
      'project.status',
      'project.owner_id',
      'project.company_id'
    );
  }
  
  return fields;
}

