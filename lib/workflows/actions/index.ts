/**
 * Workflow Action Dispatcher
 * Routes action execution to the appropriate handler
 */

import type { ActionType, StepConfig, WorkflowContext } from '@/types/workflows';
import { executeSendEmail } from './sendEmail';
import { executeSendNotification, executeSendPush } from './sendNotification';
import { executeCreateTask, executeUpdateTask } from './tasks';
import { executeUpdateContact, executeAddTag, executeRemoveTag, executeCreateContact } from './contacts';
import { executeAIGenerate, executeAICategorize, executeAISummarize } from './ai';
import { executeWebhookCall } from './webhook';
import { executeCreateProject, executeCreateProjectFromTemplate } from './projects';
import { executeCreateActivity } from './activity';
import { executeUpdateOpportunity } from './opportunities';
import { executeSendSlack } from './slack';
import logger from '@/lib/utils/logger';

export interface ActionResult {
  output: unknown;
}

/**
 * Execute a workflow action based on its type
 * 
 * @param actionType - Type of action to execute
 * @param config - Action configuration
 * @param context - Workflow execution context
 * @returns Action result with output data
 */
export async function executeAction(
  actionType: ActionType,
  config: StepConfig,
  context: WorkflowContext
): Promise<ActionResult> {
  logger.info('[Actions] Executing action:', {
    actionType,
    organizationId: context.organization_id,
  });
  
  const startTime = Date.now();
  
  try {
    let result: ActionResult;
    
    switch (actionType) {
      // Communication actions
      case 'send_email':
        result = await executeSendEmail(config, context);
        break;
        
      case 'send_notification':
        result = await executeSendNotification(config, context);
        break;
        
      case 'send_push':
        result = await executeSendPush(config, context);
        break;
      
      // Task actions
      case 'create_task':
        result = await executeCreateTask(config, context);
        break;
        
      case 'update_task':
        result = await executeUpdateTask(config, context);
        break;
      
      // Contact actions
      case 'create_contact':
        result = await executeCreateContact(config, context);
        break;
        
      case 'update_contact':
        result = await executeUpdateContact(config, context);
        break;
        
      case 'add_tag':
        result = await executeAddTag(config, context);
        break;
        
      case 'remove_tag':
        result = await executeRemoveTag(config, context);
        break;
      
      // Opportunity actions
      case 'update_opportunity':
        result = await executeUpdateOpportunity(config, context);
        break;
      
      // Project actions
      case 'create_project':
        result = await executeCreateProject(config, context);
        break;
        
      case 'create_project_from_template':
        result = await executeCreateProjectFromTemplate(config, context);
        break;
      
      // AI actions
      case 'ai_generate':
        result = await executeAIGenerate(config, context);
        break;
        
      case 'ai_categorize':
        result = await executeAICategorize(config, context);
        break;
        
      case 'ai_summarize':
        result = await executeAISummarize(config, context);
        break;
      
      // Integration actions
      case 'webhook_call':
        result = await executeWebhookCall(config, context);
        break;
        
      case 'create_activity':
        result = await executeCreateActivity(config, context);
        break;

      case 'send_slack':
        result = await executeSendSlack(config, context);
        break;
      
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
    
    const duration = Date.now() - startTime;
    logger.info('[Actions] Action completed:', {
      actionType,
      durationMs: duration,
      success: true,
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Actions] Action failed:', {
      actionType,
      durationMs: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get human-readable description of an action type
 */
export function getActionDescription(actionType: ActionType): string {
  const descriptions: Record<ActionType, string> = {
    send_email: 'Send Email',
    send_notification: 'Send In-App Notification',
    send_push: 'Send Push Notification',
    create_task: 'Create Task',
    update_task: 'Update Task',
    bulk_update_tasks: 'Bulk Update Tasks',
    create_contact: 'Create Contact',
    update_contact: 'Update Contact',
    add_tag: 'Add Tag',
    remove_tag: 'Remove Tag',
    update_opportunity: 'Update Opportunity',
    create_project_from_opportunity: 'Create Project from Opportunity',
    create_project: 'Create Project',
    create_project_from_template: 'Create Project from Template',
    ai_generate: 'AI Generate Content',
    ai_categorize: 'AI Categorize',
    ai_summarize: 'AI Summarize',
    webhook_call: 'Call Webhook',
    create_activity: 'Create Activity Log',
    send_slack: 'Send Slack Message',
  };
  
  return descriptions[actionType] || actionType;
}

/**
 * Get the icon name for an action type (for UI)
 */
export function getActionIcon(actionType: ActionType): string {
  const icons: Record<ActionType, string> = {
    send_email: 'Email',
    send_notification: 'Notifications',
    send_push: 'PhoneAndroid',
    create_task: 'AddTask',
    update_task: 'Edit',
    bulk_update_tasks: 'DynamicFeed',
    create_contact: 'PersonAdd',
    update_contact: 'PersonOutline',
    add_tag: 'Label',
    remove_tag: 'LabelOff',
    update_opportunity: 'TrendingUp',
    create_project_from_opportunity: 'Transform',
    create_project: 'CreateNewFolder',
    create_project_from_template: 'FileCopy',
    ai_generate: 'AutoAwesome',
    ai_categorize: 'Category',
    ai_summarize: 'Summarize',
    webhook_call: 'Http',
    create_activity: 'History',
    send_slack: 'Chat',
  };
  
  return icons[actionType] || 'Settings';
}

/**
 * Check if an action type requires external API calls
 */
export function isExternalAction(actionType: ActionType): boolean {
  const externalActions: ActionType[] = [
    'send_email',
    'webhook_call',
    'ai_generate',
    'ai_categorize',
    'ai_summarize',
    'send_slack',
  ];
  
  return externalActions.includes(actionType);
}

