/**
 * Centralized logging utility with environment-based filtering
 * 
 * Usage:
 * - logger.debug() - Only logs in development (NODE_ENV !== 'production')
 * - logger.info() - Production-safe info logs (always logged)
 * - logger.warn() - Always logged
 * - logger.error() - Always logged with stack traces
 * 
 * SECURITY: All logs are automatically sanitized to prevent sensitive data exposure
 */

import { redactSensitiveData, sanitizeLogMessage, containsSensitiveData } from './logSanitization';

const isDevelopment = process.env.NODE_ENV !== 'production';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const logger: Logger = {
  /**
   * Debug logs - only shown in development
   * Use for detailed debugging information that's not needed in production
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      const sanitized = args.map(arg => {
        if (containsSensitiveData(arg)) {
          return redactSensitiveData(arg);
        }
        if (typeof arg === 'string') {
          return sanitizeLogMessage(arg);
        }
        return arg;
      });
      console.log('[DEBUG]', ...sanitized);
    }
  },

  /**
   * Info logs - always shown
   * Use for important information that should be visible in production
   */
  info: (...args: unknown[]) => {
    const sanitized = args.map(arg => {
      if (containsSensitiveData(arg)) {
        return redactSensitiveData(arg);
      }
      if (typeof arg === 'string') {
        return sanitizeLogMessage(arg);
      }
      return arg;
    });
    console.log('[INFO]', ...sanitized);
  },

  /**
   * Warning logs - always shown
   * Use for warnings that should be visible in production
   */
  warn: (...args: unknown[]) => {
    const sanitized = args.map(arg => {
      if (containsSensitiveData(arg)) {
        return redactSensitiveData(arg);
      }
      if (typeof arg === 'string') {
        return sanitizeLogMessage(arg);
      }
      return arg;
    });
    console.warn('[WARN]', ...sanitized);
  },

  /**
   * Error logs - always shown with stack traces
   * Use for errors that need to be tracked in production
   * Sensitive data is automatically redacted
   */
  error: (...args: unknown[]) => {
    const sanitized = args.map(arg => {
      if (arg instanceof Error) {
        return {
          message: sanitizeLogMessage(arg.message),
          stack: arg.stack ? sanitizeLogMessage(arg.stack) : undefined,
          name: arg.name,
        };
      }
      if (containsSensitiveData(arg)) {
        return redactSensitiveData(arg);
      }
      if (typeof arg === 'string') {
        return sanitizeLogMessage(arg);
      }
      return arg;
    });
    console.error('[ERROR]', ...sanitized);
  },
};

export default logger;

