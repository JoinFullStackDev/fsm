import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess } from '@/lib/packageLimits';
import { hybridSearch } from '@/lib/kb/search';
import logger from '@/lib/utils/logger';
import type { SearchQuery } from '@/types/kb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kb/search
 * Hybrid search endpoint (full-text + vector similarity)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to search articles');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const organizationId = userData.organization_id;

    // Check KB access
    if (organizationId) {
      const hasAccess = await hasKnowledgeBaseAccess(supabase, organizationId);
      if (!hasAccess) {
        return forbidden('Knowledge base is not enabled for your organization');
      }
    }

    const body: SearchQuery = await request.json();
    const { query, category_id, tags, published_only, limit, offset } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        results: [],
        pagination: {
          limit: limit || 50,
          offset: offset || 0,
          total: 0,
        },
      });
    }

    // Perform hybrid search
    const results = await hybridSearch(supabase, {
      query,
      category_id: category_id || undefined,
      tags: tags || undefined,
      published_only: published_only !== false,
      organization_id: organizationId,
      limit: limit || 50,
      offset: offset || 0,
    });

    // Track search analytics (non-blocking)
    trackSearch(supabase, query, results.length, userData.id).catch((err) => {
      logger.error('[KB Search API] Error tracking search:', err);
    });

    return NextResponse.json({
      results,
      pagination: {
        limit: limit || 50,
        offset: offset || 0,
        total: results.length,
      },
    });
  } catch (error) {
    logger.error('[KB Search API] Exception in POST:', error);
    return internalError('Failed to perform search');
  }
}

/**
 * Track search in analytics
 */
async function trackSearch(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  query: string,
  resultCount: number,
  userId: string
): Promise<void> {
  try {
    await supabase.from('knowledge_base_analytics').insert({
      article_id: null,
      user_id: userId,
      action_type: 'search',
      metadata: {
        query,
        search_results_count: resultCount,
      },
    });
  } catch (error) {
    // Silently fail - analytics tracking shouldn't break the request
    logger.debug('[KB Search API] Analytics tracking failed:', error);
  }
}

