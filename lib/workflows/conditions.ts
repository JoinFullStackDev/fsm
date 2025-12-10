/**
 * Workflow Condition Evaluation
 * Provides logic for evaluating conditional branches in workflows
 */

import type { ConditionConfig, ConditionOperator, WorkflowContext } from '@/types/workflows';
import { getNestedValue } from './templating';
import logger from '@/lib/utils/logger';

/**
 * Evaluate a condition against the workflow context
 * 
 * @param config - Condition configuration
 * @param context - Workflow context containing values
 * @returns true if condition is met, false otherwise
 */
export function evaluateCondition(
  config: ConditionConfig,
  context: WorkflowContext | Record<string, unknown>
): boolean {
  const { field, operator, value } = config;
  
  // Get the field value from context
  const fieldValue = getNestedValue(context, field);
  
  logger.debug('[Conditions] Evaluating:', {
    field,
    operator,
    expectedValue: value,
    actualValue: fieldValue,
  });
  
  try {
    const result = evaluateOperator(operator, fieldValue, value);
    
    logger.debug('[Conditions] Result:', { result });
    
    return result;
  } catch (error) {
    logger.error('[Conditions] Evaluation error:', {
      field,
      operator,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Evaluate a specific operator
 */
function evaluateOperator(
  operator: ConditionOperator,
  fieldValue: unknown,
  expectedValue: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return isEqual(fieldValue, expectedValue);
      
    case 'not_equals':
      return !isEqual(fieldValue, expectedValue);
      
    case 'contains':
      return contains(fieldValue, expectedValue);
      
    case 'not_contains':
      return !contains(fieldValue, expectedValue);
      
    case 'starts_with':
      return startsWith(fieldValue, expectedValue);
      
    case 'ends_with':
      return endsWith(fieldValue, expectedValue);
      
    case 'gt':
      return greaterThan(fieldValue, expectedValue);
      
    case 'gte':
      return greaterThanOrEqual(fieldValue, expectedValue);
      
    case 'lt':
      return lessThan(fieldValue, expectedValue);
      
    case 'lte':
      return lessThanOrEqual(fieldValue, expectedValue);
      
    case 'is_empty':
      return isEmpty(fieldValue);
      
    case 'is_not_empty':
      return !isEmpty(fieldValue);
      
    case 'in':
      return isIn(fieldValue, expectedValue);
      
    case 'not_in':
      return !isIn(fieldValue, expectedValue);
      
    default:
      logger.warn('[Conditions] Unknown operator:', operator);
      return false;
  }
}

/**
 * Check equality (handles type coercion for strings and numbers)
 */
function isEqual(fieldValue: unknown, expectedValue: unknown): boolean {
  // Handle null/undefined
  if (fieldValue === null || fieldValue === undefined) {
    return expectedValue === null || expectedValue === undefined;
  }
  
  // Handle strict equality
  if (fieldValue === expectedValue) {
    return true;
  }
  
  // Handle number/string comparison
  if (typeof fieldValue === 'number' && typeof expectedValue === 'string') {
    return fieldValue === Number(expectedValue);
  }
  if (typeof fieldValue === 'string' && typeof expectedValue === 'number') {
    return Number(fieldValue) === expectedValue;
  }
  
  // Handle boolean comparison
  if (typeof fieldValue === 'boolean') {
    if (expectedValue === 'true' || expectedValue === true) return fieldValue === true;
    if (expectedValue === 'false' || expectedValue === false) return fieldValue === false;
  }
  
  // Handle case-insensitive string comparison
  if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
    return fieldValue.toLowerCase() === expectedValue.toLowerCase();
  }
  
  return false;
}

/**
 * Check if field value contains expected value
 */
function contains(fieldValue: unknown, expectedValue: unknown): boolean {
  if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
    return fieldValue.toLowerCase().includes(expectedValue.toLowerCase());
  }
  
  if (Array.isArray(fieldValue)) {
    return fieldValue.some((item) => isEqual(item, expectedValue));
  }
  
  return false;
}

/**
 * Check if field value starts with expected value
 */
function startsWith(fieldValue: unknown, expectedValue: unknown): boolean {
  if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
    return fieldValue.toLowerCase().startsWith(expectedValue.toLowerCase());
  }
  return false;
}

/**
 * Check if field value ends with expected value
 */
function endsWith(fieldValue: unknown, expectedValue: unknown): boolean {
  if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
    return fieldValue.toLowerCase().endsWith(expectedValue.toLowerCase());
  }
  return false;
}

/**
 * Check if field value is greater than expected value
 */
function greaterThan(fieldValue: unknown, expectedValue: unknown): boolean {
  const numField = toNumber(fieldValue);
  const numExpected = toNumber(expectedValue);
  
  if (numField !== null && numExpected !== null) {
    return numField > numExpected;
  }
  
  // Date comparison
  const dateField = toDate(fieldValue);
  const dateExpected = toDate(expectedValue);
  
  if (dateField && dateExpected) {
    return dateField.getTime() > dateExpected.getTime();
  }
  
  // String comparison
  if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
    return fieldValue > expectedValue;
  }
  
  return false;
}

/**
 * Check if field value is greater than or equal to expected value
 */
function greaterThanOrEqual(fieldValue: unknown, expectedValue: unknown): boolean {
  return greaterThan(fieldValue, expectedValue) || isEqual(fieldValue, expectedValue);
}

/**
 * Check if field value is less than expected value
 */
function lessThan(fieldValue: unknown, expectedValue: unknown): boolean {
  const numField = toNumber(fieldValue);
  const numExpected = toNumber(expectedValue);
  
  if (numField !== null && numExpected !== null) {
    return numField < numExpected;
  }
  
  // Date comparison
  const dateField = toDate(fieldValue);
  const dateExpected = toDate(expectedValue);
  
  if (dateField && dateExpected) {
    return dateField.getTime() < dateExpected.getTime();
  }
  
  // String comparison
  if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
    return fieldValue < expectedValue;
  }
  
  return false;
}

/**
 * Check if field value is less than or equal to expected value
 */
function lessThanOrEqual(fieldValue: unknown, expectedValue: unknown): boolean {
  return lessThan(fieldValue, expectedValue) || isEqual(fieldValue, expectedValue);
}

/**
 * Check if field value is empty
 */
function isEmpty(fieldValue: unknown): boolean {
  if (fieldValue === null || fieldValue === undefined) {
    return true;
  }
  
  if (typeof fieldValue === 'string') {
    return fieldValue.trim() === '';
  }
  
  if (Array.isArray(fieldValue)) {
    return fieldValue.length === 0;
  }
  
  if (typeof fieldValue === 'object') {
    return Object.keys(fieldValue).length === 0;
  }
  
  return false;
}

/**
 * Check if field value is in expected array
 */
function isIn(fieldValue: unknown, expectedValue: unknown): boolean {
  if (!Array.isArray(expectedValue)) {
    return false;
  }
  
  return expectedValue.some((item) => isEqual(fieldValue, item));
}

/**
 * Convert value to number, returns null if not possible
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }
  }
  
  return null;
}

/**
 * Convert value to Date, returns null if not possible
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

/**
 * Evaluate multiple conditions with AND/OR logic
 */
export function evaluateConditions(
  conditions: ConditionConfig[],
  context: WorkflowContext | Record<string, unknown>,
  logic: 'and' | 'or' = 'and'
): boolean {
  if (conditions.length === 0) {
    return true;
  }
  
  if (logic === 'and') {
    return conditions.every((condition) => evaluateCondition(condition, context));
  } else {
    return conditions.some((condition) => evaluateCondition(condition, context));
  }
}

/**
 * Get human-readable description of a condition
 */
export function describeCondition(config: ConditionConfig): string {
  const { field, operator, value } = config;
  
  const operatorLabels: Record<ConditionOperator, string> = {
    equals: 'equals',
    not_equals: 'does not equal',
    contains: 'contains',
    not_contains: 'does not contain',
    starts_with: 'starts with',
    ends_with: 'ends with',
    gt: 'is greater than',
    gte: 'is greater than or equal to',
    lt: 'is less than',
    lte: 'is less than or equal to',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    in: 'is one of',
    not_in: 'is not one of',
  };
  
  const operatorLabel = operatorLabels[operator] || operator;
  
  if (operator === 'is_empty' || operator === 'is_not_empty') {
    return `${field} ${operatorLabel}`;
  }
  
  const valueStr = Array.isArray(value) 
    ? `[${value.join(', ')}]` 
    : JSON.stringify(value);
    
  return `${field} ${operatorLabel} ${valueStr}`;
}

