/**
 * Workflow Test API Route
 * POST /api/workflows/[id]/test - Test run a workflow with sample data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { workflowEngine } from '@/lib/workflows/engine';
import { unauthorized, notFound, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import { testWorkflowInputSchema } from '@/lib/workflows/validation';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { Workflow, WorkflowStep } from '@/types/workflows';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/[id]/test
 * Test run a workflow with sample data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limit (stricter for test runs)
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.admin);
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
      return forbidden('You do not have permission to test workflows');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Fetch workflow with steps
    const { data: workflow, error } = await adminClient
      .from('workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();
    
    if (error || !workflow) {
      return notFound('Workflow not found');
    }
    
    // Parse body for test data
    let testData: Record<string, unknown> = {};
    try {
      const body = await request.json();
      const parseResult = testWorkflowInputSchema.safeParse(body);
      if (parseResult.success && parseResult.data.test_data) {
        testData = parseResult.data.test_data;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }
    
    // Add test flag to data
    testData._test = true;
    testData._test_by = userData.id;
    testData._test_at = new Date().toISOString();
    
    // Sort steps by order
    const steps = (workflow.steps || []) as WorkflowStep[];
    steps.sort((a, b) => a.step_order - b.step_order);
    
    logger.info('[Workflows API] Testing workflow:', {
      workflowId: id,
      workflowName: workflow.name,
      stepsCount: steps.length,
      userId: userData.id,
    });
    
    try {
      // Execute workflow
      const run = await workflowEngine.executeWorkflow(
        workflow as Workflow,
        steps,
        testData
      );
      
      logger.info('[Workflows API] Test run completed:', {
        runId: run.id,
        status: run.status,
        workflowId: id,
      });
      
      // Fetch run steps for details
      const { data: runSteps } = await adminClient
        .from('workflow_run_steps')
        .select('*')
        .eq('run_id', run.id)
        .order('step_order', { ascending: true });
      
      return NextResponse.json({
        success: run.status === 'completed',
        run_id: run.id,
        status: run.status,
        error: run.error_message,
        steps_executed: runSteps?.length || 0,
        steps: runSteps || [],
        context: run.context,
      });
      
    } catch (executionError) {
      logger.error('[Workflows API] Test execution failed:', {
        workflowId: id,
        error: executionError instanceof Error ? executionError.message : 'Unknown error',
      });
      
      return NextResponse.json({
        success: false,
        error: executionError instanceof Error ? executionError.message : 'Unknown error',
      });
    }
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in test:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to test workflow');
  }
}

