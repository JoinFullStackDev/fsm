/**
 * Workflow Action Utilities
 * Client-safe utilities for action metadata (descriptions, icons)
 */

import type { ActionType } from '@/types/workflows';

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
    create_slack_channel: 'Create Slack Channel',
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
    create_slack_channel: 'AddComment',
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
    'create_slack_channel',
  ];
  
  return externalActions.includes(actionType);
}

