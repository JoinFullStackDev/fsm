/**
 * Log sanitization utilities
 * Prevents sensitive data from being logged
 */

/**
 * Patterns that indicate sensitive data
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /session[_-]?id/i,
  /token/i,
  /credential/i,
  /bearer\s+[a-zA-Z0-9]/i,
  /authorization:/i,
  /x-api-key:/i,
  /stripe[_-]?key/i,
  /supabase[_-]?key/i,
  /service[_-]?role[_-]?key/i,
  /webhook[_-]?secret/i,
  /private[_-]?key/i,
  /\.env/i,
  /connection[_-]?string/i,
  /database[_-]?url/i,
];

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redact sensitive values from an object
 * Recursively processes objects and arrays
 */
export function redactSensitiveData(data: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[Max depth reached]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, depth + 1));
  }

  // Handle objects
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      // Redact sensitive keys
      if (typeof value === 'string' && value.length > 0) {
        // Show first 4 and last 4 characters, redact middle
        if (value.length <= 8) {
          redacted[key] = '***';
        } else {
          redacted[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        }
      } else {
        redacted[key] = '***';
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Sanitize a string that may contain sensitive information
 */
export function sanitizeLogMessage(message: string): string {
  let sanitized = message;

  // Remove common sensitive patterns
  sanitized = sanitized.replace(/password[=:]\s*[^\s]+/gi, 'password=***');
  sanitized = sanitized.replace(/secret[=:]\s*[^\s]+/gi, 'secret=***');
  sanitized = sanitized.replace(/key[=:]\s*[^\s]+/gi, 'key=***');
  sanitized = sanitized.replace(/token[=:]\s*[^\s]+/gi, 'token=***');
  sanitized = sanitized.replace(/api[_-]?key[=:]\s*[^\s]+/gi, 'api_key=***');
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9]+/gi, 'Bearer ***');
  sanitized = sanitized.replace(/x-api-key:\s*[^\s]+/gi, 'x-api-key: ***');

  return sanitized;
}

/**
 * Check if data contains sensitive information
 */
export function containsSensitiveData(data: any): boolean {
  if (typeof data === 'string') {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(data));
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.some(item => containsSensitiveData(item));
    }

    return Object.keys(data).some(key => 
      isSensitiveKey(key) || containsSensitiveData(data[key])
    );
  }

  return false;
}
