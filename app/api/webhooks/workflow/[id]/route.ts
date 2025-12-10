/**
 * Workflow Webhook Trigger API Route
 * POST /api/webhooks/workflow/[id] - Trigger a workflow via webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { workflowEngine } from '@/lib/workflows/engine';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import { createHmac, timingSafeEqual } from 'crypto';
import logger from '@/lib/utils/logger';
import type { Workflow, WorkflowStep, WebhookTriggerConfig } from '@/types/workflows';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/workflow/[id]
 * Trigger a workflow via external webhook
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limit
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.apiKey);
    if (rateLimitResponse) return rateLimitResponse;
    
    const { id } = params;
    
    // Validate UUID
    if (!isValidUUID(id)) {
      return badRequest('Invalid workflow ID');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Fetch workflow
    const { data: workflow, error } = await adminClient
      .from('workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', id)
      .eq('trigger_type', 'webhook')
      .single();
    
    if (error || !workflow) {
      logger.warn('[Webhook Trigger] Workflow not found:', { workflowId: id });
      return notFound('Workflow not found or not a webhook-triggered workflow');
    }
    
    // Check if workflow is active
    if (!workflow.is_active) {
      logger.warn('[Webhook Trigger] Workflow is not active:', { workflowId: id });
      return badRequest('Workflow is not active');
    }
    
    const triggerConfig = workflow.trigger_config as WebhookTriggerConfig;
    
    // Parse body and verify webhook signature if secret is configured
    let body: Record<string, unknown> = {};
    
    if (triggerConfig.secret) {
      const signature = request.headers.get('x-webhook-signature') || 
                        request.headers.get('x-signature');
      
      if (!signature) {
        logger.warn('[Webhook Trigger] Missing signature:', { workflowId: id });
        return unauthorized('Missing webhook signature');
      }
      
      // Get raw body for signature verification
      const rawBody = await request.text();
      
      // Verify HMAC signature
      const expectedSignature = createHmac('sha256', triggerConfig.secret)
        .update(rawBody)
        .digest('hex');
      
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (signatureBuffer.length !== expectedBuffer.length || 
          !timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.warn('[Webhook Trigger] Invalid signature:', { workflowId: id });
        return unauthorized('Invalid webhook signature');
      }
      
      // Re-parse body since we consumed it
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = { raw: rawBody };
      }
    } else {
      // No secret configured, just parse body
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }
    
    // Check IP whitelist if configured
    if (triggerConfig.allowed_ips && triggerConfig.allowed_ips.length > 0) {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       request.headers.get('x-real-ip') ||
                       'unknown';
      
      if (!triggerConfig.allowed_ips.includes(clientIp)) {
        logger.warn('[Webhook Trigger] IP not allowed:', { 
          workflowId: id, 
          clientIp,
          allowed: triggerConfig.allowed_ips,
        });
        return unauthorized('IP address not allowed');
      }
    }
    
    // Build trigger data
    const triggerData: Record<string, unknown> = {
      webhook: true,
      payload: body,
      headers: Object.fromEntries(
        Array.from(request.headers.entries())
          .filter(([key]) => !key.toLowerCase().includes('authorization'))
          .filter(([key]) => !key.toLowerCase().includes('cookie'))
      ),
      received_at: new Date().toISOString(),
    };
    
    // Sort steps by order
    const steps = (workflow.steps || []) as WorkflowStep[];
    steps.sort((a, b) => a.step_order - b.step_order);
    
    logger.info('[Webhook Trigger] Triggering workflow:', {
      workflowId: id,
      workflowName: workflow.name,
      stepsCount: steps.length,
    });
    
    // Execute workflow asynchronously
    workflowEngine
      .executeWorkflow(workflow as Workflow, steps, triggerData)
      .then((run) => {
        logger.info('[Webhook Trigger] Workflow execution started:', {
          workflowId: id,
          runId: run.id,
          status: run.status,
        });
      })
      .catch((err) => {
        logger.error('[Webhook Trigger] Workflow execution failed:', {
          workflowId: id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    
    // Return immediately (async execution)
    return NextResponse.json({
      success: true,
      message: 'Workflow triggered',
      workflow_id: id,
      workflow_name: workflow.name,
      triggered_at: new Date().toISOString(),
    }, { status: 202 }); // 202 Accepted - processing asynchronously
    
  } catch (error) {
    logger.error('[Webhook Trigger] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return internalError('Failed to trigger workflow');
  }
}

/**
 * GET /api/webhooks/workflow/[id]
 * Get webhook info (for testing/verification)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  if (!isValidUUID(id)) {
    return badRequest('Invalid workflow ID');
  }
  
  const adminClient = createAdminSupabaseClient();
  
  const { data: workflow } = await adminClient
    .from('workflows')
    .select('id, name, is_active, trigger_type')
    .eq('id', id)
    .eq('trigger_type', 'webhook')
    .single();
  
  if (!workflow) {
    return notFound('Workflow not found');
  }
  
  return NextResponse.json({
    workflow_id: workflow.id,
    name: workflow.name,
    is_active: workflow.is_active,
    trigger_type: workflow.trigger_type,
    endpoint: `/api/webhooks/workflow/${id}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'HMAC-SHA256 signature (if secret configured)',
    },
  });
}

