/**
 * Error sanitization utilities
 * Prevents information disclosure through error messages
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Sanitize error message for client response
 * In production, returns generic messages to prevent information disclosure
 * In development, returns detailed messages for debugging
 */
export function sanitizeErrorMessage(error: unknown, genericMessage: string): string {
  if (isDevelopment) {
    // In development, show detailed errors for debugging
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return genericMessage;
  }

  // In production, always return generic message
  return genericMessage;
}

/**
 * Sanitize error details object
 * Removes sensitive information like stack traces, file paths, etc.
 */
export function sanitizeErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (isDevelopment) {
    // In development, include error details
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        // Only include stack in development
        stack: error.stack,
      };
    }
    if (typeof error === 'object' && error !== null) {
      return error as Record<string, unknown>;
    }
    return { error: String(error) };
  }

  // In production, return minimal details
  return undefined;
}

/**
 * Check if an error message contains sensitive information
 * Returns true if sensitive info detected
 */
function containsSensitiveInfo(message: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /api[_-]?key/i,
    /auth[_-]?token/i,
    /session[_-]?id/i,
    /database/i,
    /connection[_-]?string/i,
    /\.env/i,
    /file:\/\//i,
    /\/home\//i,
    /\/Users\//i,
    /\/root\//i,
    /stack[_-]?trace/i,
  ];

  return sensitivePatterns.some(pattern => pattern.test(message));
}

/**
 * Sanitize error message, removing sensitive information
 */
export function removeSensitiveInfo(message: string): string {
  if (containsSensitiveInfo(message)) {
    // Replace sensitive parts with generic text
    return message
      .replace(/password[=:]\s*[^\s]+/gi, 'password=***')
      .replace(/secret[=:]\s*[^\s]+/gi, 'secret=***')
      .replace(/key[=:]\s*[^\s]+/gi, 'key=***')
      .replace(/token[=:]\s*[^\s]+/gi, 'token=***')
      .replace(/api[_-]?key[=:]\s*[^\s]+/gi, 'api_key=***')
      .replace(/file:\/\/[^\s]+/gi, 'file://***')
      .replace(/\/[^\s]+\/[^\s]+\.(env|key|pem|p12)/gi, '/***/***')
      .replace(/at\s+[^\s]+\s+\([^)]+\)/g, 'at *** (***)') // Stack trace lines
      .replace(/Error:\s*/gi, '');
  }

  return message;
}
