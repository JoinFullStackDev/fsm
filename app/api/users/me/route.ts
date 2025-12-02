import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserByAuthId } from '@/lib/utils/userQueries';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// Simple in-memory cache for user data (cleared on each request in dev, persists briefly in production)
// Cache key: authUserId -> { user, timestamp }
const userCache = new Map<string, { user: any; timestamp: number }>();
const CACHE_TTL_MS = 5000; // 5 seconds cache

/**
 * GET /api/users/me
 * Get current user's profile (bypasses RLS)
 * Cached for 5 seconds to reduce redundant database calls
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view your profile');
    }

    // Check cache first
    const cached = userCache.get(authUser.id);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      // Add cache headers for client-side caching
      const response = NextResponse.json(cached.user);
      response.headers.set('Cache-Control', 'private, max-age=5');
      return response;
    }

    // Get user record (bypasses RLS)
    const user = await getUserByAuthId(authUser.id);

    if (!user) {
      return unauthorized('User record not found');
    }

    // Update cache
    userCache.set(authUser.id, { user, timestamp: now });

    // Clean up old cache entries (keep cache size reasonable)
    if (userCache.size > 100) {
      for (const [key, value] of userCache.entries()) {
        if ((now - value.timestamp) > CACHE_TTL_MS * 2) {
          userCache.delete(key);
        }
      }
    }

    // Add cache headers
    const response = NextResponse.json(user);
    response.headers.set('Cache-Control', 'private, max-age=5');
    return response;
  } catch (error) {
    logger.error('[Users API] Error in GET /me:', error);
    return internalError('Failed to fetch user profile');
  }
}

