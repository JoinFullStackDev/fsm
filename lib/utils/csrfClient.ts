/**
 * Client-side CSRF token utilities
 * Gets CSRF token from cookie for use in API requests
 */

/**
 * Get CSRF token from cookie
 * Returns the token if found, null otherwise
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token-client') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Get headers with CSRF token included
 * Use this helper when making API requests that require CSRF protection
 */
export function getCsrfHeaders(): HeadersInit {
  const token = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['x-csrf-token'] = token;
  }

  return headers;
}

