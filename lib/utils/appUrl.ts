/**
 * Centralized App URL utility
 * Handles URL generation with proper fallbacks for different environments
 * 
 * Priority order:
 * 1. NEXT_PUBLIC_APP_URL (explicitly set production URL)
 * 2. VERCEL_URL (automatically set by Vercel for preview deployments)
 * 3. localhost fallback for local development
 */

/**
 * Get the base application URL
 * Use this for generating links in emails, notifications, etc.
 * 
 * @returns The base URL without trailing slash
 */
export function getAppUrl(): string {
  // Priority 1: Explicitly configured production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''); // Remove trailing slash if present
  }

  // Priority 2: Vercel deployment URL (for preview deployments)
  // VERCEL_URL is automatically set by Vercel and includes the deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Priority 3: Vercel production URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Fallback for local development
  return 'http://localhost:3000';
}

/**
 * Get full URL for a specific path
 * 
 * @param path - The path to append (should start with /)
 * @returns Full URL with the path
 */
export function getAppFullUrl(path: string): string {
  const baseUrl = getAppUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Check if running in production environment
 * Based on whether a production URL is configured
 */
export function isProductionUrl(): boolean {
  return !!(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL);
}

