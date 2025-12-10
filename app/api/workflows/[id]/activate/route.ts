/**
 * Workflow Activate API Route
 * POST /api/workflows/[id]/activate - Toggle workflow active status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/[id]/activate
 * Toggle workflow active status
 */
export async function POST(
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
    
    // Get user record for role check
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();
    
    if (!userData || !['admin', 'pm'].includes(userData.role)) {
      return forbidden('You do not have permission to activate workflows');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Fetch current workflow
    const { data: workflow, error: fetchError } = await adminClient
      .from('workflows')
      .select('id, name, is_active, steps:workflow_steps(count)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();
    
    if (fetchError || !workflow) {
      return notFound('Workflow not found');
    }
    
    // Parse body for explicit active value (optional)
    let targetActive: boolean;
    try {
      const body = await request.json();
      if (typeof body.is_active === 'boolean') {
        targetActive = body.is_active;
      } else {
        // Toggle current state
        targetActive = !workflow.is_active;
      }
    } catch {
      // No body, toggle current state
      targetActive = !workflow.is_active;
    }
    
    // Validate workflow has steps before activating
    const stepsCount = (workflow.steps as { count: number }[])?.[0]?.count || 0;
    if (targetActive && stepsCount === 0) {
      return badRequest('Cannot activate workflow without steps');
    }
    
    // Update workflow
    const { data: updatedWorkflow, error: updateError } = await adminClient
      .from('workflows')
      .update({
        is_active: targetActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError || !updatedWorkflow) {
      logger.error('[Workflows API] Error updating workflow status:', {
        error: updateError?.message,
        workflowId: id,
      });
      return internalError('Failed to update workflow status');
    }
    
    logger.info('[Workflows API] Workflow status updated:', {
      workflowId: id,
      name: workflow.name,
      is_active: targetActive,
      userId: userData.id,
    });
    
    return NextResponse.json({
      success: true,
      workflow_id: id,
      is_active: updatedWorkflow.is_active,
      message: targetActive ? 'Workflow activated' : 'Workflow deactivated',
    });
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in activate:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to update workflow status');
  }
}

