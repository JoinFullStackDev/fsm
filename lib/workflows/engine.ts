/**
 * Workflow Execution Engine
 * Core engine for executing workflow steps sequentially
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { executeAction } from './actions';
import { evaluateCondition } from './conditions';
import { getNestedValue } from './templating';
import logger from '@/lib/utils/logger';
import type {
  Workflow,
  WorkflowStep,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowContext,
  StepExecutionResult,
  DelayConfig,
  LoopConfig,
  ConditionConfig,
} from '@/types/workflows';
import type { ActivityEventType, ActivityEntityType } from '@/types/ops';

/**
 * Workflow Execution Engine
 * Handles the execution of workflows including steps, conditions, delays, and loops
 */
export class WorkflowEngine {
  private supabase = createAdminSupabaseClient();
  
  /**
   * Execute a workflow from the beginning
   * 
   * @param workflow - Workflow definition
   * @param steps - Workflow steps
   * @param triggerData - Data from the trigger
   * @returns The workflow run record
   */
  async executeWorkflow(
    workflow: Workflow,
    steps: WorkflowStep[],
    triggerData: Record<string, unknown>
  ): Promise<WorkflowRun> {
    logger.info('[WorkflowEngine] Starting workflow execution:', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepsCount: steps.length,
    });
    
    // Build initial context
    const initialContext = this.buildInitialContext(workflow, triggerData);
    
    // Create run record
    const { data: run, error: runError } = await this.supabase
      .from('workflow_runs')
      .insert({
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        organization_id: workflow.organization_id,
        trigger_type: workflow.trigger_type,
        trigger_data: triggerData,
        status: 'running' as WorkflowRunStatus,
        current_step: 0,
        context: initialContext,
      })
      .select()
      .single();
    
    if (runError || !run) {
      logger.error('[WorkflowEngine] Failed to create run:', {
        error: runError?.message,
        workflowId: workflow.id,
      });
      throw new Error(`Failed to create workflow run: ${runError?.message}`);
    }
    
    // Sort steps by order
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
    
    // Execute steps sequentially
    try {
      let context = initialContext;
      let stepIndex = 0;
      
      while (stepIndex < sortedSteps.length) {
        const step = sortedSteps[stepIndex];
        
        // Update current step
        await this.updateRunProgress(run.id, stepIndex, context);
        
        // Execute the step
        const result = await this.executeStep(run.id, step, context);
        
        // Update context with step output
        context = {
          ...context,
          steps: {
            ...context.steps,
            [step.step_order]: result.output,
          },
        };
        
        // Handle step result
        if (result.status === 'failed') {
          throw new Error(result.error || 'Step failed');
        }
        
        if (result.status === 'paused') {
          // Delay node - execution will resume via cron
          await this.updateRunStatus(run.id, 'paused', stepIndex + 1, context);
          logger.info('[WorkflowEngine] Workflow paused for delay:', {
            runId: run.id,
            stepOrder: step.step_order,
          });
          const updatedRun = await this.getUpdatedRun(run.id);
          return updatedRun || (run as WorkflowRun);
        }
        
        // Determine next step
        if (result.nextStepOrder !== undefined) {
          // Condition branch - find the step with matching order
          const nextIndex = sortedSteps.findIndex(s => s.step_order === result.nextStepOrder);
          if (nextIndex !== -1) {
            stepIndex = nextIndex;
          } else {
            // Step not found, continue to end
            stepIndex = sortedSteps.length;
          }
        } else {
          // Move to next step
          stepIndex++;
        }
      }
      
      // Workflow completed successfully
      await this.updateRunStatus(run.id, 'completed', sortedSteps.length, context);
      
      logger.info('[WorkflowEngine] Workflow completed:', {
        runId: run.id,
        workflowId: workflow.id,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[WorkflowEngine] Workflow execution failed:', {
        runId: run.id,
        workflowId: workflow.id,
        error: errorMessage,
      });
      await this.updateRunStatus(run.id, 'failed', run.current_step, run.context as WorkflowContext, errorMessage);
    }
    
    // Return updated run
    const finalRun = await this.getUpdatedRun(run.id);
    return finalRun || (run as WorkflowRun);
  }
  
  /**
   * Resume a paused workflow (after delay)
   * 
   * @param runId - ID of the paused run
   * @param context - Saved context
   * @returns The workflow run record
   */
  async resumeWorkflow(
    runId: string,
    context: WorkflowContext
  ): Promise<WorkflowRun | null> {
    // Get the run and workflow
    const { data: run } = await this.supabase
      .from('workflow_runs')
      .select('*, workflow:workflows(*, steps:workflow_steps(*))')
      .eq('id', runId)
      .single();
    
    if (!run || !run.workflow) {
      logger.warn('[WorkflowEngine] Cannot resume - run or workflow not found:', { runId });
      return null;
    }
    
    const workflow = run.workflow as Workflow & { steps: WorkflowStep[] };
    const steps = workflow.steps || [];
    
    // Sort steps
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
    
    // Find starting point
    const startIndex = sortedSteps.findIndex(s => s.step_order === run.current_step);
    if (startIndex === -1) {
      logger.warn('[WorkflowEngine] Cannot resume - step not found:', {
        runId,
        currentStep: run.current_step,
      });
      return null;
    }
    
    logger.info('[WorkflowEngine] Resuming workflow:', {
      runId,
      workflowId: workflow.id,
      fromStep: run.current_step,
    });
    
    // Update status to running
    await this.updateRunStatus(runId, 'running', run.current_step, context);
    
    // Continue execution
    try {
      let currentContext = context;
      let stepIndex = startIndex;
      
      while (stepIndex < sortedSteps.length) {
        const step = sortedSteps[stepIndex];
        
        // Update current step
        await this.updateRunProgress(runId, stepIndex, currentContext);
        
        // Execute the step
        const result = await this.executeStep(runId, step, currentContext);
        
        // Update context
        currentContext = {
          ...currentContext,
          steps: {
            ...currentContext.steps,
            [step.step_order]: result.output,
          },
        };
        
        // Handle result
        if (result.status === 'failed') {
          throw new Error(result.error || 'Step failed');
        }
        
        if (result.status === 'paused') {
          await this.updateRunStatus(runId, 'paused', stepIndex + 1, currentContext);
          return this.getUpdatedRun(runId);
        }
        
        // Determine next step
        if (result.nextStepOrder !== undefined) {
          const nextIndex = sortedSteps.findIndex(s => s.step_order === result.nextStepOrder);
          stepIndex = nextIndex !== -1 ? nextIndex : sortedSteps.length;
        } else {
          stepIndex++;
        }
      }
      
      // Completed
      await this.updateRunStatus(runId, 'completed', sortedSteps.length, currentContext);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateRunStatus(runId, 'failed', run.current_step, context, errorMessage);
    }
    
    return this.getUpdatedRun(runId);
  }
  
  /**
   * Execute a single step
   */
  private async executeStep(
    runId: string,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    // Log step start
    const { data: stepLog } = await this.supabase
      .from('workflow_run_steps')
      .insert({
        run_id: runId,
        step_id: step.id,
        step_order: step.step_order,
        step_type: step.step_type,
        action_type: step.action_type,
        status: 'running',
        input_data: { config_keys: Object.keys(step.config) },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    const stepLogId = stepLog?.id;
    
    try {
      let result: StepExecutionResult;
      
      switch (step.step_type) {
        case 'action':
          if (!step.action_type) {
            throw new Error('Action type is required for action steps');
          }
          const actionResult = await executeAction(step.action_type, step.config, context);
          result = { status: 'success', output: actionResult.output };
          break;
        
        case 'condition':
          const conditionMet = evaluateCondition(step.config as ConditionConfig, context);
          result = {
            status: 'success',
            output: { condition_met: conditionMet },
            nextStepOrder: conditionMet 
              ? step.step_order + 1 
              : step.else_goto_step ?? step.step_order + 1,
          };
          break;
        
        case 'delay':
          result = await this.scheduleDelay(runId, step, context);
          break;
        
        case 'loop':
          result = await this.executeLoop(runId, step, context);
          break;
        
        default:
          throw new Error(`Unknown step type: ${step.step_type}`);
      }
      
      // Log step completion
      if (stepLogId) {
        await this.supabase
          .from('workflow_run_steps')
          .update({
            status: result.paused ? 'pending' : 'success',
            output_data: result.output as Record<string, unknown>,
            completed_at: new Date().toISOString(),
          })
          .eq('id', stepLogId);
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log step failure
      if (stepLogId) {
        await this.supabase
          .from('workflow_run_steps')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', stepLogId);
      }
      
      return { status: 'failed', error: errorMessage };
    }
  }
  
  /**
   * Schedule a delay step
   */
  private async scheduleDelay(
    runId: string,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const config = step.config as DelayConfig;
    
    // Calculate delay in milliseconds
    let delayMs: number;
    switch (config.delay_type) {
      case 'minutes':
        delayMs = config.delay_value * 60 * 1000;
        break;
      case 'hours':
        delayMs = config.delay_value * 60 * 60 * 1000;
        break;
      case 'days':
        delayMs = config.delay_value * 24 * 60 * 60 * 1000;
        break;
      default:
        delayMs = config.delay_value * 60 * 1000; // Default to minutes
    }
    
    const executeAt = new Date(Date.now() + delayMs);
    
    // Create scheduled step record
    await this.supabase
      .from('workflow_scheduled_steps')
      .insert({
        run_id: runId,
        step_order: step.step_order + 1, // Resume at next step
        execute_at: executeAt.toISOString(),
        context: context,
        status: 'pending',
      });
    
    logger.info('[WorkflowEngine] Delay scheduled:', {
      runId,
      executeAt: executeAt.toISOString(),
      delayType: config.delay_type,
      delayValue: config.delay_value,
    });
    
    return {
      status: 'success',
      output: {
        scheduled_for: executeAt.toISOString(),
        delay_type: config.delay_type,
        delay_value: config.delay_value,
      },
      paused: true,
    };
  }
  
  /**
   * Execute a loop step
   * Note: This is a simplified implementation that logs iterations
   * A full implementation would support nested step execution
   */
  private async executeLoop(
    runId: string,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const config = step.config as LoopConfig;
    
    // Get the collection from context
    const collection = getNestedValue(context, config.collection_field);
    
    if (!Array.isArray(collection)) {
      logger.warn('[WorkflowEngine] Loop collection not found or not an array:', {
        field: config.collection_field,
      });
      return {
        status: 'success',
        output: {
          iterations: 0,
          skipped: true,
          reason: 'Collection not found or not an array',
        },
      };
    }
    
    const maxIterations = config.max_iterations || 100;
    const iterations = Math.min(collection.length, maxIterations);
    
    logger.info('[WorkflowEngine] Executing loop:', {
      runId,
      collectionLength: collection.length,
      iterations,
    });
    
    // For now, just record the iterations
    // A full implementation would execute child steps for each item
    const results = collection.slice(0, iterations).map((item, index) => ({
      index,
      [config.item_variable]: item,
    }));
    
    return {
      status: 'success',
      output: {
        iterations,
        max_iterations: maxIterations,
        collection_length: collection.length,
        results,
      },
    };
  }
  
  /**
   * Build initial context from trigger data
   */
  private buildInitialContext(
    workflow: Workflow,
    triggerData: Record<string, unknown>
  ): WorkflowContext {
    return {
      trigger: {
        type: workflow.trigger_type,
        event_type: triggerData.event_type as ActivityEventType | undefined,
        entity_type: triggerData.entity_type as ActivityEntityType | undefined,
        entity_id: triggerData.entity_id as string | undefined,
        data: triggerData,
      },
      steps: {},
      organization_id: workflow.organization_id,
      triggered_by_user_id: triggerData.user_id as string | undefined,
      triggered_at: new Date().toISOString(),
      // Entity snapshots
      contact: triggerData.contact as Record<string, unknown> | undefined,
      opportunity: triggerData.opportunity as Record<string, unknown> | undefined,
      task: triggerData.task as Record<string, unknown> | undefined,
      project: triggerData.project as Record<string, unknown> | undefined,
      company: triggerData.company as Record<string, unknown> | undefined,
    };
  }
  
  /**
   * Update run progress
   */
  private async updateRunProgress(
    runId: string,
    currentStep: number,
    context: WorkflowContext
  ): Promise<void> {
    await this.supabase
      .from('workflow_runs')
      .update({
        current_step: currentStep,
        context: context,
      })
      .eq('id', runId);
  }
  
  /**
   * Update run status
   */
  private async updateRunStatus(
    runId: string,
    status: WorkflowRunStatus,
    currentStep: number,
    context: WorkflowContext,
    errorMessage?: string
  ): Promise<void> {
    await this.supabase
      .from('workflow_runs')
      .update({
        status,
        current_step: currentStep,
        context: context,
        error_message: errorMessage || null,
        completed_at: ['completed', 'failed', 'cancelled'].includes(status)
          ? new Date().toISOString()
          : null,
      })
      .eq('id', runId);
  }
  
  /**
   * Get updated run record
   */
  private async getUpdatedRun(runId: string): Promise<WorkflowRun | null> {
    const { data } = await this.supabase
      .from('workflow_runs')
      .select()
      .eq('id', runId)
      .single();
    
    return data as WorkflowRun | null;
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();

