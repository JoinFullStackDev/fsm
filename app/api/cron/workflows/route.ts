/**
 * Workflow Cron API Route
 * POST /api/cron/workflows - Process scheduled and delayed workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledWorkflows, resumeDelayedWorkflows } from '@/lib/workflows/triggers/scheduled';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// Maximum execution time for cron job (50 seconds to leave buffer)
export const maxDuration = 50;

/**
 * POST /api/cron/workflows
 * Process scheduled workflows and resume delayed workflows
 * This endpoint should be called by Vercel Cron every 5 minutes
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Cron Workflows] Invalid cron secret');
      return unauthorized('Invalid cron secret');
    }
    
    logger.info('[Cron Workflows] Starting workflow processing');
    
    // Process scheduled workflows (daily, weekly, monthly triggers)
    const scheduledResults = await processScheduledWorkflows();
    
    // Resume delayed workflows (workflows paused by delay nodes)
    const delayedResults = await resumeDelayedWorkflows();
    
    const duration = Date.now() - startTime;
    
    logger.info('[Cron Workflows] Processing complete:', {
      scheduled: scheduledResults,
      delayed: delayedResults,
      durationMs: duration,
    });
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      scheduled: scheduledResults,
      delayed: delayedResults,
      duration_ms: duration,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('[Cron Workflows] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });
    
    return internalError('Failed to process workflows', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration,
    });
  }
}

/**
 * GET /api/cron/workflows
 * Health check for the cron endpoint
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for health check too
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized('Invalid cron secret');
  }
  
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/cron/workflows',
    description: 'Workflow scheduler cron endpoint',
    methods: ['POST'],
    schedule: 'Every 5 minutes (recommended)',
  });
}

