import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getOrganizationContext } from '@/lib/organizationContext';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// Simple in-memory cache for organization context (30 second TTL)
const contextCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function getCachedContext(userId: string): any | null {
  const cached = contextCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    contextCache.delete(userId); // Remove expired entry
  }
  return null;
}

function setCachedContext(userId: string, data: any): void {
  contextCache.set(userId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  
  // Clean up expired entries periodically (keep cache size reasonable)
  if (contextCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of contextCache.entries()) {
      if (value.expiresAt <= now) {
        contextCache.delete(key);
      }
    }
  }
}

/**
 * GET /api/organization/context
 * Get current user's organization context
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view organization context');
    }

    // Check cache first
    const cached = getCachedContext(user.id);
    if (cached) {
      return NextResponse.json(cached);
    }

    const context = await getOrganizationContext(supabase, user.id);

    if (!context) {
      return internalError('Failed to load organization context');
    }

    // Cache the result
    setCachedContext(user.id, context);

    return NextResponse.json(context);
  } catch (error) {
    logger.error('Error in GET /api/organization/context:', error);
    return internalError('Failed to load organization context', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

