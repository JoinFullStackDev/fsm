/**
 * Scheduled Workflow Triggers
 * Handles cron-based workflow execution and delayed step resumption
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { workflowEngine } from '../engine';
import logger from '@/lib/utils/logger';
import type { 
  Workflow, 
  WorkflowStep, 
  ScheduleTriggerConfig,
  WorkflowContext,
} from '@/types/workflows';

/**
 * Process scheduled workflows
 * Called by cron job to check and execute workflows due to run
 * 
 * @returns Processing results
 */
export async function processScheduledWorkflows(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = createAdminSupabaseClient();
  const now = new Date();
  
  logger.info('[Scheduled] Processing scheduled workflows:', {
    timestamp: now.toISOString(),
  });
  
  // Get active scheduled workflows
  const { data: workflows, error } = await supabase
    .from('workflows')
    .select('*, steps:workflow_steps(*)')
    .eq('is_active', true)
    .eq('trigger_type', 'schedule');
  
  if (error) {
    logger.error('[Scheduled] Error fetching workflows:', {
      error: error.message,
    });
    return { processed: 0, errors: 1 };
  }
  
  if (!workflows || workflows.length === 0) {
    logger.debug('[Scheduled] No scheduled workflows found');
    return { processed: 0, errors: 0 };
  }
  
  let processed = 0;
  let errors = 0;
  
  for (const workflow of workflows) {
    try {
      const config = workflow.trigger_config as ScheduleTriggerConfig;
      
      if (shouldRunNow(config, now)) {
        logger.info('[Scheduled] Running workflow:', {
          workflowId: workflow.id,
          workflowName: workflow.name,
          scheduleType: config.schedule_type,
        });
        
        await workflowEngine.executeWorkflow(
          workflow as Workflow,
          (workflow.steps || []) as WorkflowStep[],
          {
            scheduled: true,
            run_time: now.toISOString(),
            schedule_type: config.schedule_type,
          }
        );
        
        processed++;
      }
    } catch (err) {
      logger.error('[Scheduled] Workflow execution failed:', {
        workflowId: workflow.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      errors++;
    }
  }
  
  logger.info('[Scheduled] Processing complete:', {
    processed,
    errors,
    total: workflows.length,
  });
  
  return { processed, errors };
}

/**
 * Resume delayed workflows
 * Called by cron job to check and resume workflows paused by delay nodes
 * 
 * @returns Resumption results
 */
export async function resumeDelayedWorkflows(): Promise<{
  resumed: number;
  errors: number;
}> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  
  logger.info('[Delayed] Checking for delayed workflows to resume:', {
    timestamp: now,
  });
  
  // Get pending scheduled steps that are due
  const { data: scheduledSteps, error } = await supabase
    .from('workflow_scheduled_steps')
    .select('*')
    .eq('status', 'pending')
    .lte('execute_at', now)
    .order('execute_at', { ascending: true })
    .limit(100); // Process in batches
  
  if (error) {
    logger.error('[Delayed] Error fetching scheduled steps:', {
      error: error.message,
    });
    return { resumed: 0, errors: 1 };
  }
  
  if (!scheduledSteps || scheduledSteps.length === 0) {
    logger.debug('[Delayed] No delayed workflows to resume');
    return { resumed: 0, errors: 0 };
  }
  
  let resumed = 0;
  let errors = 0;
  
  for (const scheduled of scheduledSteps) {
    try {
      // Mark as executed (prevent duplicate processing)
      const { error: updateError } = await supabase
        .from('workflow_scheduled_steps')
        .update({ status: 'executed' })
        .eq('id', scheduled.id)
        .eq('status', 'pending'); // Optimistic locking
      
      if (updateError) {
        // Someone else may have processed it
        continue;
      }
      
      logger.info('[Delayed] Resuming workflow:', {
        runId: scheduled.run_id,
        stepOrder: scheduled.step_order,
      });
      
      // Resume the workflow
      await workflowEngine.resumeWorkflow(
        scheduled.run_id,
        scheduled.context as WorkflowContext
      );
      
      resumed++;
    } catch (err) {
      logger.error('[Delayed] Failed to resume workflow:', {
        scheduledId: scheduled.id,
        runId: scheduled.run_id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      
      // Mark as failed
      await supabase
        .from('workflow_scheduled_steps')
        .update({ status: 'cancelled' })
        .eq('id', scheduled.id);
      
      errors++;
    }
  }
  
  logger.info('[Delayed] Resumption complete:', {
    resumed,
    errors,
    total: scheduledSteps.length,
  });
  
  return { resumed, errors };
}

/**
 * Check if a scheduled workflow should run now
 */
function shouldRunNow(config: ScheduleTriggerConfig, now: Date): boolean {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  
  // Parse target time (default to 9:00 AM)
  const [targetHour, targetMinute] = (config.time || '09:00')
    .split(':')
    .map(Number);
  
  // Check if within 5-minute window (for cron job frequency)
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = targetHour * 60 + targetMinute;
  const timeDiff = Math.abs(currentMinutes - targetMinutes);
  
  if (timeDiff > 5 && timeDiff < (24 * 60 - 5)) {
    // Not within time window (accounting for midnight wrap)
    return false;
  }
  
  switch (config.schedule_type) {
    case 'daily':
      return true;
      
    case 'weekly':
      // Default to Monday (1)
      return dayOfWeek === (config.day_of_week ?? 1);
      
    case 'monthly':
      // Default to 1st of month
      return dayOfMonth === (config.day_of_month ?? 1);
      
    case 'cron':
      // For cron expressions, would need a cron parser library
      // For now, skip cron type (would need to add cron-parser)
      logger.warn('[Scheduled] Cron expressions not yet supported');
      return false;
      
    default:
      return false;
  }
}

/**
 * Get pending scheduled steps count
 * Useful for monitoring
 */
export async function getPendingScheduledStepsCount(): Promise<number> {
  const supabase = createAdminSupabaseClient();
  
  const { count, error } = await supabase
    .from('workflow_scheduled_steps')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  if (error) {
    logger.error('[Scheduled] Error counting pending steps:', {
      error: error.message,
    });
    return 0;
  }
  
  return count || 0;
}

/**
 * Cancel all pending scheduled steps for a run
 * Called when a workflow run is cancelled
 */
export async function cancelScheduledSteps(runId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  
  const { error } = await supabase
    .from('workflow_scheduled_steps')
    .update({ status: 'cancelled' })
    .eq('run_id', runId)
    .eq('status', 'pending');
  
  if (error) {
    logger.error('[Scheduled] Error cancelling scheduled steps:', {
      runId,
      error: error.message,
    });
  }
}

