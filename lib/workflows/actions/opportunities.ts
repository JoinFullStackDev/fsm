/**
 * Opportunity Actions
 * Update opportunities via workflow automation
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { interpolateTemplate, interpolateObject, getNestedValue } from '../templating';
import type { UpdateOpportunityConfig, WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute update opportunity action
 * 
 * @param config - Opportunity update configuration
 * @param context - Workflow context
 * @returns Action result with updated opportunity details
 */
export async function executeUpdateOpportunity(
  config: UpdateOpportunityConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const oppConfig = config as UpdateOpportunityConfig;
  const supabase = createAdminSupabaseClient();
  
  // Get opportunity ID from config or context
  let opportunityId: string | undefined;
  
  if (oppConfig.opportunity_id) {
    opportunityId = interpolateTemplate(oppConfig.opportunity_id, context);
  } else if (oppConfig.opportunity_field) {
    const fieldValue = getNestedValue(context, oppConfig.opportunity_field);
    opportunityId = typeof fieldValue === 'string' ? fieldValue : undefined;
  }
  
  if (!opportunityId) {
    throw new Error('No opportunity ID found for opportunity update');
  }
  
  // Interpolate update values
  const updates = interpolateObject(oppConfig.updates, context) as Record<string, unknown>;
  
  // Add updated_at timestamp
  updates.updated_at = new Date().toISOString();
  
  if (Object.keys(updates).length === 1) {
    // Only updated_at
    logger.warn('[UpdateOpportunity] No updates specified');
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No updates specified',
        opportunity_id: opportunityId,
      },
    };
  }
  
  logger.info('[UpdateOpportunity] Updating opportunity:', {
    opportunityId,
    updates: Object.keys(updates).filter(k => k !== 'updated_at'),
  });
  
  try {
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', opportunityId)
      .select()
      .single();
    
    if (error) {
      logger.error('[UpdateOpportunity] Failed to update opportunity:', {
        error: error.message,
        opportunityId,
      });
      throw new Error(`Failed to update opportunity: ${error.message}`);
    }
    
    logger.info('[UpdateOpportunity] Opportunity updated:', {
      opportunityId: opportunity.id,
      updates: Object.keys(updates).filter(k => k !== 'updated_at'),
    });
    
    return {
      output: {
        success: true,
        opportunity_id: opportunity.id,
        updates,
        opportunity,
        updated_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[UpdateOpportunity] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      opportunityId,
    });
    throw error;
  }
}

