/**
 * Batch API endpoint
 * Allows clients to combine multiple queries into a single request
 * Reduces round trips and improves performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { executeBatchQueries, BatchQueryRequest } from '@/lib/utils/batchQueries';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/batch
 * Execute multiple queries in a single request
 * 
 * Body: {
 *   queries: [
 *     { type: 'project_phases', params: { projectId: '...' } },
 *     { type: 'project_members', params: { projectId: '...' } },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to use batch queries');
    }

    const body = await request.json();
    const { queries } = body;

    if (!Array.isArray(queries) || queries.length === 0) {
      return badRequest('queries must be a non-empty array');
    }

    if (queries.length > 10) {
      return badRequest('Maximum 10 queries per batch request');
    }

    // Validate query structure
    for (const query of queries) {
      if (!query.type || !query.params) {
        return badRequest('Each query must have type and params');
      }
    }

    // Execute batch queries
    const results = await executeBatchQueries(queries as BatchQueryRequest[]);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    logger.error('[Batch API] Error executing batch queries:', error);
    return internalError('Failed to execute batch queries', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

