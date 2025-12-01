/**
 * Input sanitization utilities for security
 * Prevents SQL injection and other injection attacks
 */

/**
 * Sanitize search input for use in Supabase ilike queries
 * Removes SQL wildcards and escape characters, limits length
 * 
 * @param input - Raw search input from user
 * @param maxLength - Maximum length allowed (default: 100)
 * @returns Sanitized search string safe for use in queries
 */
export function sanitizeSearchInput(input: string | null | undefined, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove SQL wildcards (% and _) and escape characters (\)
  // These could be used for SQL injection-like attacks in Supabase queries
  let sanitized = input
    .replace(/[%_\\]/g, '') // Remove wildcards and escape chars
    .trim();

  // Limit length to prevent DoS attacks
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate UUID format
 * @param id - String to validate as UUID
 * @returns True if valid UUID format, false otherwise
 */
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
