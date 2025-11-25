/**
 * Form validation utilities
 * Provides common validation functions for forms across the application
 */

/**
 * Validates an email address
 * @param email - The email address to validate
 * @returns Object with validation result and optional error message
 * @example
 * const result = validateEmail('user@example.com');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

/**
 * Validates a required text field
 * @param value - The value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns Object with validation result and optional error message
 */
export function validateRequired(value: string, fieldName: string = 'Field'): { valid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

/**
 * Validates text length against min/max constraints
 * @param value - The value to validate
 * @param min - Minimum length (optional)
 * @param max - Maximum length (optional)
 * @param fieldName - The name of the field (for error messages)
 * @returns Object with validation result and optional error message
 */
export function validateLength(
  value: string,
  min?: number,
  max?: number,
  fieldName: string = 'Field'
): { valid: boolean; error?: string } {
  const length = value.trim().length;

  if (min !== undefined && length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  }

  if (max !== undefined && length > max) {
    return { valid: false, error: `${fieldName} must be no more than ${max} characters` };
  }

  return { valid: true };
}

/**
 * Validates a project name
 * Ensures the name is not empty and within length constraints (1-100 characters)
 * @param name - The project name to validate
 * @returns Object with validation result and optional error message
 */
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  const required = validateRequired(name, 'Project name');
  if (!required.valid) {
    return required;
  }

  const length = validateLength(name, 1, 100, 'Project name');
  if (!length.valid) {
    return length;
  }

  // Project name should not be only whitespace
  if (name.trim().length === 0) {
    return { valid: false, error: 'Project name cannot be empty' };
  }

  return { valid: true };
}

/**
 * Validates a user name
 * Ensures the name is not empty and within length constraints (1-100 characters)
 * @param name - The user name to validate
 * @returns Object with validation result and optional error message
 */
export function validateUserName(name: string): { valid: boolean; error?: string } {
  const required = validateRequired(name, 'Name');
  if (!required.valid) {
    return required;
  }

  const length = validateLength(name, 1, 100, 'Name');
  if (!length.valid) {
    return length;
  }

  return { valid: true };
}

/**
 * Validates a field key (for template fields)
 * Field keys must be lowercase letters, numbers, and underscores only
 * @param key - The field key to validate
 * @returns Object with validation result and optional error message
 */
export function validateFieldKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'Field key is required' };
  }

  // Field key should be lowercase, alphanumeric, and underscores only
  const keyRegex = /^[a-z0-9_]+$/;
  if (!keyRegex.test(key)) {
    return { valid: false, error: 'Field key must be lowercase letters, numbers, and underscores only' };
  }

  return { valid: true };
}

/**
 * Validates a field label (for template fields)
 * Ensures the label is not empty and within length constraints (1-200 characters)
 * @param label - The field label to validate
 * @returns Object with validation result and optional error message
 */
export function validateFieldLabel(label: string): { valid: boolean; error?: string } {
  const required = validateRequired(label, 'Label');
  if (!required.valid) {
    return required;
  }

  const length = validateLength(label, 1, 200, 'Label');
  if (!length.valid) {
    return length;
  }

  return { valid: true };
}

