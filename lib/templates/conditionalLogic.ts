import type { TemplateFieldConfig } from '@/types/templates';

/**
 * Evaluates conditional logic for a field to determine if it should be visible
 * 
 * Supports two types of conditions:
 * - showIf: Field is visible only if these conditions are met
 * - hideIf: Field is hidden if these conditions are met
 * 
 * Logic operator ('AND' or 'OR') determines how multiple conditions are combined:
 * - AND: All conditions must be true
 * - OR: At least one condition must be true
 * 
 * Priority: hideIf takes precedence over showIf (if hideIf is true, field is hidden)
 */
export function evaluateConditionalLogic(
  field: TemplateFieldConfig,
  phaseData: Record<string, any>
): boolean {
  if (!field.conditional_logic) {
    return true; // No conditions, always show
  }

  const { showIf, hideIf, logic = 'AND' } = field.conditional_logic;

  // Evaluate showIf conditions
  // If showIf exists, field must pass these conditions to be visible
  if (showIf && showIf.length > 0) {
    const showResults = showIf.map(condition => evaluateCondition(condition, phaseData));
    // Combine results based on logic operator
    const showPassed = logic === 'AND' 
      ? showResults.every(result => result)  // All must be true
      : showResults.some(result => result);  // At least one must be true
    
    if (!showPassed) {
      return false; // Show conditions not met, hide the field
    }
  }

  // Evaluate hideIf conditions
  // If hideIf exists and conditions are met, field is hidden (takes precedence)
  if (hideIf && hideIf.length > 0) {
    const hideResults = hideIf.map(condition => evaluateCondition(condition, phaseData));
    // Combine results based on logic operator
    const hidePassed = logic === 'AND'
      ? hideResults.every(result => result)  // All must be true to hide
      : hideResults.some(result => result);  // At least one must be true to hide
    
    if (hidePassed) {
      return false; // Hide conditions met, hide the field
    }
  }

  return true; // All conditions passed, show the field
}

/**
 * Evaluates a single condition against phase data
 * 
 * Supports various operators:
 * - equals: Exact match
 * - notEquals: Not equal
 * - contains: String/array contains value
 * - greaterThan: Numeric comparison
 * - lessThan: Numeric comparison
 * - has: Field has any truthy value
 * 
 * @param condition - The condition to evaluate
 * @param phaseData - The phase data to check against
 * @returns True if condition is met, false otherwise
 */
function evaluateCondition(
  condition: { field: string; operator: string; value: unknown },
  phaseData: Record<string, any>
): boolean {
  const fieldValue = phaseData[condition.field];
  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'notEquals':
      return fieldValue !== conditionValue;
    case 'contains':
      // Supports both arrays and strings
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(conditionValue);
      }
      if (typeof fieldValue === 'string') {
        return fieldValue.includes(String(conditionValue));
      }
      return false;
    case 'greaterThan':
      // Convert both values to numbers for comparison
      return Number(fieldValue) > Number(conditionValue);
    case 'lessThan':
      // Convert both values to numbers for comparison
      return Number(fieldValue) < Number(conditionValue);
    case 'has':
      // Check if field has a truthy value (not null, undefined, empty string, etc.)
      return !!fieldValue;
    default:
      // Unknown operator, default to true (show field) to avoid breaking UI
      return true;
  }
}

