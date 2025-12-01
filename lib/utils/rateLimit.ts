/**
 * Rate limiting utility
 * Prevents abuse and DoS attacks by limiting request frequency
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, consider using Redis or @upstash/ratelimit
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client identifier for rate limiting
 * Uses IP address or user ID if available
 */
function getClientId(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Get IP address from headers (works with most proxies/CDNs)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 * @returns null if allowed, NextResponse with error if rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string
): NextResponse | null {
  const clientId = getClientId(request, userId);
  const now = Date.now();
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(clientId, entry);
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    logger.warn('[Rate Limit] Request rate limited:', {
      clientId: clientId.replace(/user:|ip:/, ''),
      count: entry.count,
      maxRequests: config.maxRequests,
      path: request.nextUrl.pathname,
    });
    
    const message = config.message || 'Too many requests, please try again later';
    const response = NextResponse.json(
      { error: message },
      { status: 429 }
    );
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    response.headers.set('Retry-After', Math.ceil((entry.resetTime - now) / 1000).toString());
    
    return response;
  }
  
  // Add rate limit headers to successful response
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
  
  return null; // Not rate limited
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
  },
  
  // Moderate limits for admin endpoints
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'Too many admin requests. Please slow down.',
  },
  
  // Standard limits for API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many API requests. Please slow down.',
  },
  
  // Lenient limits for general endpoints
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests. Please slow down.',
  },
  
  // Very strict limits for API key endpoints
  apiKey: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // 120 requests per minute (higher for API usage)
    message: 'API rate limit exceeded. Please slow down.',
  },
} as const;

/**
 * Rate limit middleware wrapper
 * Use this in API routes to apply rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  config: RateLimitConfig,
  getUserId?: (request: NextRequest) => Promise<string | undefined>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const userId = getUserId ? await getUserId(request) : undefined;
    const rateLimitResponse = checkRateLimit(request, config, userId);
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(request, ...args);
  };
}

/**
 * Helper to get user ID from request for rate limiting
 * Returns undefined if not authenticated
 */
export async function getUserIdForRateLimit(request: NextRequest): Promise<string | undefined> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabaseServer');
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  } catch {
    return undefined;
  }
}
