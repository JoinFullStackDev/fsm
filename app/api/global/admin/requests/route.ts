import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { FeatureBugRequestUpdate } from '@/types/requests';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/requests
 * Get all feature requests and bug reports (super admin only)
 * Supports filtering by type and status via query parameters
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'feature' or 'bug'
    const status = searchParams.get('status'); // 'open', 'in_progress', 'resolved', 'closed'
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = adminClient
      .from('feature_bug_requests')
      .select(`
        *,
        user:users!feature_bug_requests_user_id_fkey(id, name, email),
        assigned_user:users!feature_bug_requests_assigned_to_fkey(id, name, email),
        resolved_user:users!feature_bug_requests_resolved_by_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type === 'feature' || type === 'bug') {
      query = query.eq('type', type);
    }
    if (status === 'open' || status === 'in_progress' || status === 'resolved' || status === 'closed') {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      logger.error('[Admin Requests API] Error fetching requests:', error);
      return internalError('Failed to fetch requests', { error: error.message });
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[Admin Requests API] Error in GET /api/global/admin/requests:', error);
    return internalError('Failed to fetch requests', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PATCH /api/global/admin/requests
 * Update a feature request or bug report (super admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const body = await request.json();
    const { id, ...updates }: { id: string } & FeatureBugRequestUpdate = body;

    if (!id) {
      return badRequest('Request ID is required');
    }

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(updates.status)) {
        return badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Validate priority if provided
    if (updates.priority) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(updates.priority)) {
        return badRequest(`Priority must be one of: ${validPriorities.join(', ')}`);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to;
    if (updates.resolution_notes !== undefined) updateData.resolution_notes = updates.resolution_notes;

    // If status is being set to resolved, the trigger will handle resolved_at and resolved_by
    // But we can also set it explicitly if needed
    if (updates.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = userId;
    } else if (updates.status) {
      // If changing from resolved to something else, clear resolved fields
      // (status is already validated to be one of: 'open', 'in_progress', 'resolved', 'closed')
      updateData.resolved_at = null;
      updateData.resolved_by = null;
    }

    const { data: updatedRequest, error } = await adminClient
      .from('feature_bug_requests')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        user:users!feature_bug_requests_user_id_fkey(id, name, email),
        assigned_user:users!feature_bug_requests_assigned_to_fkey(id, name, email),
        resolved_user:users!feature_bug_requests_resolved_by_fkey(id, name, email)
      `)
      .single();

    if (error) {
      logger.error('[Admin Requests API] Error updating request:', error);
      return internalError('Failed to update request', { error: error.message });
    }

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[Admin Requests API] Error in PATCH /api/global/admin/requests:', error);
    return internalError('Failed to update request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

