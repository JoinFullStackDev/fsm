/**
 * Workflow Event Bus
 * Emits events and triggers matching workflows
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { workflowEngine } from './engine';
import { getNestedValue } from './templating';
import logger from '@/lib/utils/logger';
import type { ActivityEventType, ActivityEntityType } from '@/types/ops';
import type { 
  Workflow, 
  WorkflowStep, 
  EventTriggerConfig,
  WorkflowEventPayload,
} from '@/types/workflows';

/**
 * Emit a workflow event - checks for matching workflows and triggers them
 * This function is non-blocking - workflows execute in the background
 * 
 * @param payload - Event payload containing event details
 */
export async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
  const {
    event_type,
    entity_type,
    entity_id,
    entity_data,
    organization_id,
    user_id,
  } = payload;
  
  logger.debug('[EventBus] Event received:', {
    event_type,
    entity_type,
    entity_id,
    organization_id,
  });
  
  try {
    const supabase = createAdminSupabaseClient();
    
    // Find active workflows with event triggers for this organization
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .eq('trigger_type', 'event');
    
    if (error) {
      logger.error('[EventBus] Error fetching workflows:', {
        error: error.message,
        organization_id,
      });
      return;
    }
    
    if (!workflows || workflows.length === 0) {
      logger.debug('[EventBus] No active event-triggered workflows found');
      return;
    }
    
    // Check each workflow's trigger config
    for (const workflow of workflows) {
      const config = workflow.trigger_config as EventTriggerConfig;
      
      // Check if event type matches
      if (config.event_types && config.event_types.length > 0) {
        if (!config.event_types.includes(event_type)) {
          continue;
        }
      }
      
      // Check if entity type matches (if specified)
      if (config.entity_type && config.entity_type !== entity_type) {
        continue;
      }
      
      // Check filters
      if (config.filters && !matchesFilters(config.filters, entity_data)) {
        continue;
      }
      
      // Trigger the workflow!
      logger.info('[EventBus] Triggering workflow:', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        event_type,
        entity_type,
      });
      
      // Execute async (don't block the event)
      workflowEngine
        .executeWorkflow(
          workflow as Workflow,
          (workflow.steps || []) as WorkflowStep[],
          {
            event_type,
            entity_type,
            entity_id,
            user_id,
            [entity_type]: entity_data,
          }
        )
        .catch((err) => {
          logger.error('[EventBus] Workflow execution failed:', {
            workflowId: workflow.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    }
  } catch (error) {
    logger.error('[EventBus] Error in emitWorkflowEvent:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      event_type,
      entity_type,
    });
  }
}

/**
 * Helper function to emit event with common parameters
 */
export async function emitEntityEvent(
  eventType: ActivityEventType,
  entityType: ActivityEntityType,
  entityId: string,
  entityData: Record<string, unknown>,
  organizationId: string,
  userId?: string
): Promise<void> {
  return emitWorkflowEvent({
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    entity_data: entityData,
    organization_id: organizationId,
    user_id: userId,
  });
}

/**
 * Check if entity data matches filter conditions
 */
function matchesFilters(
  filters: Record<string, unknown>,
  data: Record<string, unknown>
): boolean {
  for (const [key, filterValue] of Object.entries(filters)) {
    const dataValue = getNestedValue(data, key);
    
    if (typeof filterValue === 'object' && filterValue !== null) {
      // Complex filter operators
      const filterObj = filterValue as Record<string, unknown>;
      
      if ('$in' in filterObj) {
        const inValues = filterObj.$in as unknown[];
        if (!inValues.includes(dataValue)) return false;
      }
      
      if ('$ne' in filterObj) {
        if (dataValue === filterObj.$ne) return false;
      }
      
      if ('$gt' in filterObj) {
        if (!(Number(dataValue) > Number(filterObj.$gt))) return false;
      }
      
      if ('$gte' in filterObj) {
        if (!(Number(dataValue) >= Number(filterObj.$gte))) return false;
      }
      
      if ('$lt' in filterObj) {
        if (!(Number(dataValue) < Number(filterObj.$lt))) return false;
      }
      
      if ('$lte' in filterObj) {
        if (!(Number(dataValue) <= Number(filterObj.$lte))) return false;
      }
      
      if ('$contains' in filterObj) {
        if (typeof dataValue !== 'string' || !dataValue.includes(String(filterObj.$contains))) {
          return false;
        }
      }
      
      if ('$exists' in filterObj) {
        const shouldExist = filterObj.$exists as boolean;
        const exists = dataValue !== undefined && dataValue !== null;
        if (shouldExist !== exists) return false;
      }
    } else {
      // Simple equality check
      if (dataValue !== filterValue) {
        // Try case-insensitive string comparison
        if (
          typeof dataValue === 'string' &&
          typeof filterValue === 'string' &&
          dataValue.toLowerCase() === filterValue.toLowerCase()
        ) {
          continue;
        }
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get the count of workflows that would match an event
 * Useful for debugging and testing
 */
export async function getMatchingWorkflowCount(
  eventType: ActivityEventType,
  entityType: ActivityEntityType,
  organizationId: string,
  entityData?: Record<string, unknown>
): Promise<number> {
  const supabase = createAdminSupabaseClient();
  
  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, trigger_config')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('trigger_type', 'event');
  
  if (!workflows) return 0;
  
  let count = 0;
  
  for (const workflow of workflows) {
    const config = workflow.trigger_config as EventTriggerConfig;
    
    // Check event type
    if (config.event_types?.length > 0 && !config.event_types.includes(eventType)) {
      continue;
    }
    
    // Check entity type
    if (config.entity_type && config.entity_type !== entityType) {
      continue;
    }
    
    // Check filters
    if (entityData && config.filters && !matchesFilters(config.filters, entityData)) {
      continue;
    }
    
    count++;
  }
  
  return count;
}

