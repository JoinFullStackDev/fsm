/**
 * CSRF protection utilities
 * Implements double-submit cookie pattern for CSRF protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import logger from './logger';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_CLIENT_COOKIE_NAME = 'csrf-token-client'; // Non-httpOnly cookie for client-side access
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a CSRF token using Web Crypto API (Edge Runtime compatible)
 */
export function generateCsrfToken(): string {
  // Use Web Crypto API which is available in Edge Runtime
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Set CSRF token in response cookie
 * Call this when generating a page that needs CSRF protection
 * Works in both middleware and API routes
 */
export async function setCsrfToken(response: NextResponse): Promise<NextResponse> {
  const token = generateCsrfToken();
  
  // Check if we're in middleware context (response.cookies is available)
  // or API route context (need to use cookies() helper)
  if (response.cookies) {
    // Middleware context - use response.cookies
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });
    
    response.cookies.set(CSRF_CLIENT_COOKIE_NAME, token, {
      httpOnly: false, // Allow JavaScript to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });
  } else {
    // API route context - use cookies() helper
    const cookieStore = await cookies();
    cookieStore.set(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });
    
    cookieStore.set(CSRF_CLIENT_COOKIE_NAME, token, {
      httpOnly: false, // Allow JavaScript to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });
  }
  
  // Also set in response headers for client-side access
  response.headers.set('X-CSRF-Token', token);
  
  return response;
}

/**
 * Verify CSRF token from request
 * Returns true if valid, false otherwise
 */
export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
  try {
    // Get token from header
    const headerToken = request.headers.get(CSRF_HEADER_NAME);
    if (!headerToken) {
      logger.warn('[CSRF] Missing CSRF token in header');
      return false;
    }

    // Get token from cookie
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
    if (!cookieToken) {
      logger.warn('[CSRF] Missing CSRF token in cookie');
      return false;
    }

    // Compare tokens using constant-time comparison to prevent timing attacks
    if (headerToken.length !== cookieToken.length) {
      return false;
    }

    // Constant-time comparison (Edge Runtime compatible)
    // Convert hex strings to Uint8Array for comparison
    const headerMatch = headerToken.match(/.{1,2}/g);
    const cookieMatch = cookieToken.match(/.{1,2}/g);
    
    if (!headerMatch || !cookieMatch) {
      return false;
    }
    
    const headerBytes = new Uint8Array(headerMatch.map(byte => parseInt(byte, 16)));
    const cookieBytes = new Uint8Array(cookieMatch.map(byte => parseInt(byte, 16)));
    
    if (headerBytes.length !== cookieBytes.length) {
      return false;
    }

    // Constant-time comparison using XOR
    let result = 0;
    for (let i = 0; i < headerBytes.length; i++) {
      result |= headerBytes[i] ^ cookieBytes[i];
    }
    return result === 0;
  } catch (error) {
    logger.error('[CSRF] Error verifying CSRF token:', error);
    return false;
  }
}

/**
 * Verify Origin header as additional CSRF protection
 * Checks that the request origin matches the expected origin
 */
export function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Get expected origin from environment or request
  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL 
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : null;
  
  // If no expected origin configured, skip origin check (not ideal but allows flexibility)
  if (!expectedOrigin) {
    // Still check that origin/referer exists and is not from external site
    if (origin && !origin.startsWith('http://localhost') && !origin.startsWith('https://')) {
      return false;
    }
    return true;
  }
  
  // Check origin matches expected
  if (origin && origin !== expectedOrigin) {
    logger.warn('[CSRF] Origin mismatch:', { origin, expectedOrigin });
    return false;
  }
  
  // Also check referer as fallback
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (refererOrigin !== expectedOrigin) {
      logger.warn('[CSRF] Referer origin mismatch:', { refererOrigin, expectedOrigin });
      return false;
    }
  }
  
  return true;
}

/**
 * Middleware to check CSRF protection for state-changing requests
 * Use this in POST/PUT/DELETE/PATCH handlers
 */
export async function requireCsrfToken(request: NextRequest): Promise<NextResponse | null> {
  // Skip CSRF check for GET/HEAD/OPTIONS requests
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }

  // Verify CSRF token
  const isValidToken = await verifyCsrfToken(request);
  if (!isValidToken) {
    logger.warn('[CSRF] Invalid CSRF token:', {
      method,
      path: request.nextUrl.pathname,
      ip: request.headers.get('x-forwarded-for') || request.ip,
    });
    
    return NextResponse.json(
      { error: 'Invalid CSRF token. Please refresh the page and try again.' },
      { status: 403 }
    );
  }

  // Verify Origin header as additional protection
  const isValidOrigin = verifyOrigin(request);
  if (!isValidOrigin) {
    logger.warn('[CSRF] Invalid origin:', {
      method,
      path: request.nextUrl.pathname,
      origin: request.headers.get('origin'),
    });
    
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403 }
    );
  }

  return null; // CSRF check passed
}

/**
 * Note: For API routes that are called from external sources (like webhooks),
 * CSRF protection should be disabled or handled differently.
 * Use this function to skip CSRF for specific routes.
 */
export function shouldSkipCsrf(pathname: string): boolean {
  // Skip CSRF for webhook endpoints (they use signature verification instead)
  // Skip for API key authenticated endpoints (they use API key auth instead)
  // Skip for public endpoints that don't modify state
  const skipPaths = [
    '/api/stripe/webhook',
    '/api/webhooks/',
    '/api/v1/', // API key authenticated endpoints
  ];
  
  return skipPaths.some(path => pathname.startsWith(path));
}
