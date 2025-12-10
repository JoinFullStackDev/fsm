/**
 * Workflow Runs API Route
 * GET /api/workflows/[id]/runs - Get execution history for a workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/[id]/runs
 * Get execution history for a workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limit
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.api);
    if (rateLimitResponse) return rateLimitResponse;
    
    const { id } = params;
    
    // Validate UUID
    if (!isValidUUID(id)) {
      return badRequest('Invalid workflow ID');
    }
    
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return unauthorized('You must be logged in');
    }
    
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return unauthorized('Organization not found');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Verify workflow belongs to org
    const { data: workflow } = await adminClient
      .from('workflows')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();
    
    if (!workflow) {
      return notFound('Workflow not found');
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Fetch runs
    let query = adminClient
      .from('workflow_runs')
      .select('*', { count: 'exact' })
      .eq('workflow_id', id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: runs, error, count } = await query;
    
    if (error) {
      logger.error('[Workflows API] Error fetching runs:', {
        error: error.message,
        workflowId: id,
      });
      return internalError('Failed to fetch runs');
    }
    
    return NextResponse.json({
      data: runs || [],
      total: count || 0,
      limit,
      offset,
    });
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in GET runs:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to fetch runs');
  }
}

