/**
 * Workflows API Routes
 * GET /api/workflows - List workflows
 * POST /api/workflows - Create workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import { createWorkflowInputSchema, validateWorkflow } from '@/lib/workflows/validation';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows
 * List workflows for the organization
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.api);
    if (rateLimitResponse) return rateLimitResponse;
    
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return unauthorized('You must be logged in');
    }
    
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return unauthorized('Organization not found');
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('is_active');
    const triggerType = searchParams.get('trigger_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    const adminClient = createAdminSupabaseClient();
    
    let query = adminClient
      .from('workflows')
      .select('*, steps:workflow_steps(count), runs:workflow_runs(count)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }
    
    if (triggerType) {
      query = query.eq('trigger_type', triggerType);
    }
    
    const { data: workflows, error, count } = await query;
    
    if (error) {
      logger.error('[Workflows API] Error fetching workflows:', {
        error: error.message,
        organizationId,
      });
      return internalError('Failed to fetch workflows');
    }
    
    return NextResponse.json({
      data: workflows || [],
      total: count || 0,
      limit,
      offset,
    });
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in GET:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to fetch workflows');
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.api);
    if (rateLimitResponse) return rateLimitResponse;
    
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
    
    if (!userData) {
      return unauthorized('User not found');
    }
    
    // Check permission (admin or pm only)
    if (!['admin', 'pm'].includes(userData.role)) {
      return forbidden('You do not have permission to create workflows');
    }
    
    // Parse and validate body
    const body = await request.json();
    
    logger.info('[Workflows API] Received workflow data:', {
      name: body.name,
      trigger_type: body.trigger_type,
      trigger_config: body.trigger_config,
      stepsCount: body.steps?.length || 0,
    });
    
    // Validate with Zod
    const parseResult = createWorkflowInputSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      logger.error('[Workflows API] Zod validation failed:', { errors });
      return badRequest('Invalid workflow data', { errors });
    }
    
    // Additional validation
    const validationResult = validateWorkflow(body);
    if (!validationResult.valid) {
      logger.error('[Workflows API] Custom validation failed:', {
        errors: validationResult.errors,
      });
      return badRequest('Invalid workflow configuration', {
        errors: validationResult.errors,
      });
    }
    
    const { name, description, trigger_type, trigger_config, steps } = parseResult.data;
    
    const adminClient = createAdminSupabaseClient();
    
    // Create workflow
    const { data: workflow, error: workflowError } = await adminClient
      .from('workflows')
      .insert({
        organization_id: organizationId,
        name,
        description: description || null,
        trigger_type,
        trigger_config: trigger_config || {},
        created_by: userData.id,
        is_active: false, // Workflows start inactive
      })
      .select()
      .single();
    
    if (workflowError || !workflow) {
      logger.error('[Workflows API] Error creating workflow:', {
        error: workflowError?.message,
        organizationId,
      });
      return internalError('Failed to create workflow');
    }
    
    // Create steps if provided
    if (steps && Array.isArray(steps) && steps.length > 0) {
      const stepsToInsert = steps.map((step, index) => ({
        workflow_id: workflow.id,
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
        logger.error('[Workflows API] Error creating steps:', {
          error: stepsError.message,
          workflowId: workflow.id,
        });
        // Don't fail the whole request, just log
      }
    }
    
    logger.info('[Workflows API] Workflow created:', {
      workflowId: workflow.id,
      name: workflow.name,
      organizationId,
    });
    
    // Fetch complete workflow with steps
    const { data: completeWorkflow } = await adminClient
      .from('workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', workflow.id)
      .single();
    
    return NextResponse.json(completeWorkflow || workflow, { status: 201 });
    
  } catch (error) {
    logger.error('[Workflows API] Unexpected error in POST:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to create workflow');
  }
}

