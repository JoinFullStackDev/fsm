/**
 * Email notification helpers
 * Sends emails alongside in-app notifications
 */

import { createAdminSupabaseClient } from './supabaseAdmin';
import { sendEmailWithRetry, isEmailConfigured } from './emailService';
import {
  getTaskAssignedTemplate,
  getTaskUpdatedTemplate,
  getProjectCreatedTemplate,
  getProjectInitiatedTemplate,
  getContactAddedTemplate,
  getCompanyAddedTemplate,
} from './emailTemplates';
import logger from './utils/logger';

/**
 * Check if user has email notifications enabled
 */
async function isEmailNotificationEnabled(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    // Default to enabled if not set
    return user?.preferences?.notifications?.email !== false;
  } catch (error) {
    logger.error('[EmailNotifications] Error checking user preferences:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Get user email address
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    return user?.email || null;
  } catch (error) {
    logger.error('[EmailNotifications] Error getting user email:', error);
    return null;
  }
}

/**
 * Send task assigned email notification
 */
export async function sendTaskAssignedEmail(
  assigneeId: string,
  taskTitle: string,
  projectName: string,
  assignerName: string,
  taskLink: string
): Promise<void> {
  try {
    const emailEnabled = await isEmailNotificationEnabled(assigneeId);
    if (!emailEnabled) {
      return;
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return;
    }

    const userEmail = await getUserEmail(assigneeId);
    if (!userEmail) {
      return;
    }

    // Get user name
    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('name')
      .eq('id', assigneeId)
      .single();

    const template = await getTaskAssignedTemplate(
      user?.name || 'User',
      taskTitle,
      projectName,
      assignerName,
      taskLink
    );

    await sendEmailWithRetry(userEmail, template.subject, template.html, template.text);
  } catch (error) {
    logger.error('[EmailNotifications] Error sending task assigned email:', error);
    // Don't throw - email failures shouldn't break the flow
  }
}

/**
 * Send task updated email notification
 */
export async function sendTaskUpdatedEmail(
  userId: string,
  taskTitle: string,
  projectName: string,
  updateDetails: string,
  taskLink: string
): Promise<void> {
  try {
    const emailEnabled = await isEmailNotificationEnabled(userId);
    if (!emailEnabled) {
      return;
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return;
    }

    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      return;
    }

    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const template = await getTaskUpdatedTemplate(
      user?.name || 'User',
      taskTitle,
      projectName,
      updateDetails,
      taskLink
    );

    await sendEmailWithRetry(userEmail, template.subject, template.html, template.text);
  } catch (error) {
    logger.error('[EmailNotifications] Error sending task updated email:', error);
  }
}

/**
 * Send project created email notification
 */
export async function sendProjectCreatedEmail(
  recipientId: string,
  projectName: string,
  creatorName: string,
  projectLink: string
): Promise<void> {
  try {
    const emailEnabled = await isEmailNotificationEnabled(recipientId);
    if (!emailEnabled) {
      return;
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return;
    }

    const userEmail = await getUserEmail(recipientId);
    if (!userEmail) {
      return;
    }

    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('name')
      .eq('id', recipientId)
      .single();

    const template = await getProjectCreatedTemplate(
      user?.name || 'User',
      projectName,
      creatorName,
      projectLink
    );

    await sendEmailWithRetry(userEmail, template.subject, template.html, template.text);
  } catch (error) {
    logger.error('[EmailNotifications] Error sending project created email:', error);
  }
}

/**
 * Send project initiated email notification
 */
export async function sendProjectInitiatedEmail(
  recipientId: string,
  projectName: string,
  projectLink: string
): Promise<void> {
  try {
    const emailEnabled = await isEmailNotificationEnabled(recipientId);
    if (!emailEnabled) {
      return;
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return;
    }

    const userEmail = await getUserEmail(recipientId);
    if (!userEmail) {
      return;
    }

    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('name')
      .eq('id', recipientId)
      .single();

    const template = await getProjectInitiatedTemplate(
      user?.name || 'User',
      projectName,
      projectLink
    );

    await sendEmailWithRetry(userEmail, template.subject, template.html, template.text);
  } catch (error) {
    logger.error('[EmailNotifications] Error sending project initiated email:', error);
  }
}

/**
 * Send contact added email notification
 */
export async function sendContactAddedEmail(
  recipientId: string,
  contactName: string,
  companyName: string,
  contactLink: string
): Promise<void> {
  try {
    const emailEnabled = await isEmailNotificationEnabled(recipientId);
    if (!emailEnabled) {
      return;
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return;
    }

    const userEmail = await getUserEmail(recipientId);
    if (!userEmail) {
      return;
    }

    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('name')
      .eq('id', recipientId)
      .single();

    const template = await getContactAddedTemplate(
      user?.name || 'User',
      contactName,
      companyName,
      contactLink
    );

    await sendEmailWithRetry(userEmail, template.subject, template.html, template.text);
  } catch (error) {
    logger.error('[EmailNotifications] Error sending contact added email:', error);
  }
}

/**
 * Send company added email notification
 */
export async function sendCompanyAddedEmail(
  recipientId: string,
  companyName: string,
  companyLink: string
): Promise<void> {
  try {
    const emailEnabled = await isEmailNotificationEnabled(recipientId);
    if (!emailEnabled) {
      return;
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return;
    }

    const userEmail = await getUserEmail(recipientId);
    if (!userEmail) {
      return;
    }

    const adminClient = createAdminSupabaseClient();
    const { data: user } = await adminClient
      .from('users')
      .select('name')
      .eq('id', recipientId)
      .single();

    const template = await getCompanyAddedTemplate(
      user?.name || 'User',
      companyName,
      companyLink
    );

    await sendEmailWithRetry(userEmail, template.subject, template.html, template.text);
  } catch (error) {
    logger.error('[EmailNotifications] Error sending company added email:', error);
  }
}

