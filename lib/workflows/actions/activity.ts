/**
 * Activity Log Action
 * Create activity feed entries via workflow automation
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { interpolateTemplate, getNestedValue } from '../templating';
import type { CreateActivityConfig, WorkflowContext } from '@/types/workflows';
import type { ActivityEventType, ActivityEntityType } from '@/types/ops';
import logger from '@/lib/utils/logger';

/**
 * Execute create activity action
 * 
 * @param config - Activity creation configuration
 * @param context - Workflow context
 * @returns Action result with created activity details
 */
export async function executeCreateActivity(
  config: CreateActivityConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const activityConfig = config as CreateActivityConfig;
  const supabase = createAdminSupabaseClient();
  
  // Get company ID from config or context
  let companyId: string | undefined;
  
  if (activityConfig.company_id) {
    companyId = interpolateTemplate(activityConfig.company_id, context);
  } else if (activityConfig.company_field) {
    const fieldValue = getNestedValue(context, activityConfig.company_field);
    companyId = typeof fieldValue === 'string' ? fieldValue : undefined;
  }
  
  if (!companyId) {
    logger.warn('[CreateActivity] No company ID found, skipping activity creation');
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No company ID found',
      },
    };
  }
  
  // Interpolate message
  const message = interpolateTemplate(activityConfig.message, context);
  
  // Get entity ID if specified
  let entityId: string | null = null;
  if (activityConfig.entity_field) {
    const fieldValue = getNestedValue(context, activityConfig.entity_field);
    entityId = typeof fieldValue === 'string' ? fieldValue : null;
  }
  
  logger.info('[CreateActivity] Creating activity:', {
    companyId,
    eventType: activityConfig.event_type,
    entityType: activityConfig.entity_type,
  });
  
  try {
    const { data: activity, error } = await supabase
      .from('activity_feed_items')
      .insert({
        company_id: companyId,
        related_entity_id: entityId,
        related_entity_type: activityConfig.entity_type as ActivityEntityType,
        event_type: activityConfig.event_type as ActivityEventType,
        message,
      })
      .select()
      .single();
    
    if (error) {
      // If the table doesn't exist, skip silently
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.warn('[CreateActivity] Activity feed table does not exist, skipping');
        return {
          output: {
            success: false,
            skipped: true,
            reason: 'Activity feed table does not exist',
          },
        };
      }
      
      logger.error('[CreateActivity] Failed to create activity:', {
        error: error.message,
        companyId,
      });
      throw new Error(`Failed to create activity: ${error.message}`);
    }
    
    logger.info('[CreateActivity] Activity created:', {
      activityId: activity.id,
      eventType: activityConfig.event_type,
    });
    
    return {
      output: {
        success: true,
        activity_id: activity.id,
        company_id: companyId,
        message,
        event_type: activityConfig.event_type,
        entity_type: activityConfig.entity_type,
        created_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[CreateActivity] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId,
    });
    throw error;
  }
}

