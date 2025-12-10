import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import {
  unauthorized,
  notFound,
  badRequest,
  forbidden,
  internalError,
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import {
  executeCreateTask,
  executeLogDecision,
  executeLogDebt,
  executeUpdateSpec,
} from '@/lib/workspace/actionExecutor';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/conversations/[conversationId]/actions
 * Execute AI-suggested action after user confirmation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; conversationId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, conversationId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(conversationId)) {
      return badRequest('Invalid ID format');
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

    // Verify conversation exists
    const { data: conversation } = await adminClient
      .from('workspace_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!conversation) {
      return notFound('Conversation not found');
    }

    // Parse action data
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return badRequest('Action type and data are required');
    }

    // Execute action based on type
    let result;

    switch (type) {
      case 'create_task':
        result = await executeCreateTask(data, projectId, adminClient);
        break;

      case 'log_decision':
        result = await executeLogDecision(data, workspace.id, adminClient);
        break;

      case 'log_debt':
        result = await executeLogDebt(data, workspace.id, adminClient);
        break;

      case 'update_spec':
        result = await executeUpdateSpec(data, workspace.id, adminClient);
        break;

      default:
        return badRequest(`Unknown action type: ${type}`);
    }

    logger.info('[Action API] Action executed:', {
      type,
      conversationId,
      result,
    });

    return NextResponse.json({
      success: true,
      type,
      result,
    });
  } catch (error) {
    logger.error('[Action API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
