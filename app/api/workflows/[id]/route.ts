/**
 * Workflow Detail API Routes
 * GET /api/workflows/[id] - Get workflow details
 * PUT /api/workflows/[id] - Update workflow
 * DELETE /api/workflows/[id] - Delete workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import { updateWorkflowInputSchema } from '@/lib/workflows/validation';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/[id]
 * Get workflow details with steps
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
    
    const { data: workflow, error } = await adminClient
      .from('workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();
    
    if (error || !workflow) {
      return notFound('Workflow not found');
    }
    
    // Sort steps by order
    if (workflow.steps && Array.isArray(workflow.steps)) {
      workflow.steps.sort((a: { step_order: number }, b: { step_order: number }) => 
        a.step_order - b.step_order
      );
    }
    
    return NextResponse.json(workflow);
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in GET [id]:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to fetch workflow');
  }
}

/**
 * PUT /api/workflows/[id]
 * Update a workflow
 */
export async function PUT(
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
      return forbidden('You do not have permission to update workflows');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Check workflow exists and belongs to org
    const { data: existingWorkflow } = await adminClient
      .from('workflows')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();
    
    if (!existingWorkflow) {
      return notFound('Workflow not found');
    }
    
    // Parse and validate body
    const body = await request.json();
    
    const parseResult = updateWorkflowInputSchema.safeParse(body);
    if (!parseResult.success) {
      return badRequest('Invalid workflow data', {
        errors: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      });
    }
    
    const { name, description, trigger_type, trigger_config, is_active, steps } = parseResult.data;
    
    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (trigger_config !== undefined) updates.trigger_config = trigger_config;
    if (is_active !== undefined) updates.is_active = is_active;
    
    // Update workflow
    const { data: workflow, error: updateError } = await adminClient
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError || !workflow) {
      logger.error('[Workflows API] Error updating workflow:', {
        error: updateError?.message,
        workflowId: id,
      });
      return internalError('Failed to update workflow');
    }
    
    // Update steps if provided
    if (steps !== undefined && Array.isArray(steps)) {
      // Delete existing steps
      await adminClient
        .from('workflow_steps')
        .delete()
        .eq('workflow_id', id);
      
      // Insert new steps
      if (steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          workflow_id: id,
          step_order: index,
          step_type: step.step_type,
          action_type: step.action_type || null,
          config: step.config || {},
          else_goto_step: step.else_goto_step ?? null,
        }));
        
        const { error: stepsError } = await adminClient
          .from('workflow_steps')
          .insert(stepsToInsert);
        
        if (stepsError) {
          logger.error('[Workflows API] Error updating steps:', {
            error: stepsError.message,
            workflowId: id,
          });
        }
      }
    }
    
    logger.info('[Workflows API] Workflow updated:', {
      workflowId: id,
      updates: Object.keys(updates),
    });
    
    // Fetch complete workflow with steps
    const { data: completeWorkflow } = await adminClient
      .from('workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', id)
      .single();
    
    // Sort steps
    if (completeWorkflow?.steps) {
      completeWorkflow.steps.sort((a: { step_order: number }, b: { step_order: number }) => 
        a.step_order - b.step_order
      );
    }
    
    return NextResponse.json(completeWorkflow || workflow);
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in PUT:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to update workflow');
  }
}

/**
 * DELETE /api/workflows/[id]
 * Delete a workflow
 */
export async function DELETE(
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
    
    // Only admins can delete workflows
    if (!userData || userData.role !== 'admin') {
      return forbidden('You do not have permission to delete workflows');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Check workflow exists and belongs to org
    const { data: existingWorkflow } = await adminClient
      .from('workflows')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();
    
    if (!existingWorkflow) {
      return notFound('Workflow not found');
    }
    
    // Delete workflow (cascade will handle steps)
    const { error } = await adminClient
      .from('workflows')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error('[Workflows API] Error deleting workflow:', {
        error: error.message,
        workflowId: id,
      });
      return internalError('Failed to delete workflow');
    }
    
    logger.info('[Workflows API] Workflow deleted:', {
      workflowId: id,
      name: existingWorkflow.name,
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in DELETE:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to delete workflow');
  }
}

