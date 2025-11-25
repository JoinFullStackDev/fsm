/**
 * Centralized logging utility with environment-based filtering
 * 
 * Usage:
 * - logger.debug() - Only logs in development (NODE_ENV !== 'production')
 * - logger.info() - Production-safe info logs (always logged)
 * - logger.warn() - Always logged
 * - logger.error() - Always logged with stack traces
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

const logger: Logger = {
  /**
   * Debug logs - only shown in development
   * Use for detailed debugging information that's not needed in production
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logs - always shown
   * Use for important information that should be visible in production
   */
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },

  /**
   * Warning logs - always shown
   * Use for warnings that should be visible in production
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Error logs - always shown with stack traces
   * Use for errors that need to be tracked in production
   */
  error: (...args: any[]) => {
    const errorArgs = args.map(arg => {
      if (arg instanceof Error) {
        return {
          message: arg.message,
          stack: arg.stack,
          name: arg.name,
        };
      }
      return arg;
    });
    console.error('[ERROR]', ...errorArgs);
  },
};

export default logger;

