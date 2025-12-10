import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { 
  unauthorized, 
  notFound, 
  badRequest, 
  forbidden, 
  internalError 
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateDebtInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/debt
 * List all debt items for a workspace with optional filters
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    const adminClient = createAdminSupabaseClient();

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const debt_type = searchParams.get('debt_type');

    // Build query
    let query = adminClient
      .from('workspace_debt')
      .select('*')
      .eq('workspace_id', workspace.id);

    if (status) {
      query = query.eq('status', status);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (debt_type) {
      query = query.eq('debt_type', debt_type);
    }

    const { data: debtItems, error } = await query.order('identified_date', { ascending: false });

    if (error) {
      logger.error('[Debt API] Failed to fetch debt items:', error);
      return internalError('Failed to fetch debt items');
    }

    return NextResponse.json(debtItems || []);
  } catch (error) {
    logger.error('[Debt API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/debt
 * Create new debt item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    const adminClient = createAdminSupabaseClient();

    // Get user record
    const { data: user } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return notFound('User record not found');
    }

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Parse request body
    const body = await request.json();
    const input: CreateDebtInput = body;

    if (!input.title || !input.description || !input.debt_type) {
      return badRequest('Title, description, and debt type are required');
    }

    // Create debt item
    const { data: debtItem, error } = await adminClient
      .from('workspace_debt')
      .insert({
        workspace_id: workspace.id,
        title: input.title,
        description: input.description,
        debt_type: input.debt_type,
        severity: input.severity || 'medium',
        impact_areas: input.impact_areas || [],
        estimated_effort: input.estimated_effort || null,
        identified_date: input.identified_date || new Date().toISOString().split('T')[0],
        related_task_ids: input.related_task_ids || [],
        status: 'open',
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !debtItem) {
      logger.error('[Debt API] Failed to create debt item:', error);
      return internalError('Failed to create debt item');
    }

    logger.info('[Debt API] Created debt item:', {
      debtId: debtItem.id,
      workspaceId: workspace.id,
      title: debtItem.title,
    });

    return NextResponse.json(debtItem);
  } catch (error) {
    logger.error('[Debt API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
