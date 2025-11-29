/**
 * Email template definitions and rendering
 * Uses simple string replacement for variables
 */

import { createAdminSupabaseClient } from './supabaseAdmin';
import logger from './utils/logger';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Replace template variables in a string
 * Variables format: {{variableName}}
 */
function replaceVariables(template: string, variables: Record<string, string | number | null | undefined>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value?.toString() || '');
  }
  return result;
}

/**
 * Get email template from admin settings or use default
 */
async function getTemplate(key: string, defaultTemplate: EmailTemplate): Promise<EmailTemplate> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: setting } = await adminClient
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .eq('category', 'email')
      .single();

    if (setting?.value && typeof setting.value === 'object') {
      const template = setting.value as { subject?: string; html?: string; text?: string };
      return {
        subject: template.subject || defaultTemplate.subject,
        html: template.html || defaultTemplate.text || defaultTemplate.html,
        text: template.text || defaultTemplate.text,
      };
    }
  } catch (error) {
    logger.debug('[EmailTemplates] Error loading template, using default:', key);
  }

  return defaultTemplate;
}

/**
 * Get app name from admin settings
 */
async function getAppName(): Promise<string> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: setting } = await adminClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'system_app_name')
      .eq('category', 'system')
      .single();

    if (setting?.value) {
      return String(setting.value);
    }
  } catch (error) {
    logger.debug('[EmailTemplates] Error loading app name');
  }

  return 'FullStack Method™ App';
}

/**
 * Password Reset Email Template
 */
export async function getPasswordResetTemplate(
  userName: string,
  resetLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Your Password</h2>
          <p>Hello {{userName}},</p>
          <p>You requested to reset your password for your {{appName}} account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="{{resetLink}}" class="button">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <div class="footer">
            <p>This is an automated message from {{appName}}.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${userName},\n\nYou requested to reset your password for your ${appName} account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this password reset, please ignore this email.`,
  };

  const template = await getTemplate('email_password_reset_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { userName, appName }),
    html: replaceVariables(template.html, { userName, resetLink, appName }),
    text: template.text ? replaceVariables(template.text, { userName, resetLink, appName }) : undefined,
  };
}

/**
 * Project Created Email Template
 */
export async function getProjectCreatedTemplate(
  recipientName: string,
  projectName: string,
  creatorName: string,
  projectLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'New Project Created: {{projectName}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>New Project Created</h2>
          <p>Hello {{recipientName}},</p>
          <p>{{creatorName}} has created a new project: <strong>{{projectName}}</strong></p>
          <a href="{{projectLink}}" class="button">View Project</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${recipientName},\n\n${creatorName} has created a new project: ${projectName}\n\nView it here: ${projectLink}`,
  };

  const template = await getTemplate('email_project_created_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { projectName }),
    html: replaceVariables(template.html, { recipientName, projectName, creatorName, projectLink, appName }),
    text: template.text ? replaceVariables(template.text, { recipientName, projectName, creatorName, projectLink, appName }) : undefined,
  };
}

/**
 * Project Initiated Email Template
 */
export async function getProjectInitiatedTemplate(
  recipientName: string,
  projectName: string,
  projectLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'Project Management Initiated: {{projectName}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Project Management Initiated</h2>
          <p>Hello {{recipientName}},</p>
          <p>Project management has been initiated for <strong>{{projectName}}</strong>.</p>
          <p>Tasks are being generated and the project is ready for management.</p>
          <a href="{{projectLink}}" class="button">View Project</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${recipientName},\n\nProject management has been initiated for ${projectName}.\n\nTasks are being generated and the project is ready for management.\n\nView it here: ${projectLink}`,
  };

  const template = await getTemplate('email_project_initiated_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { projectName }),
    html: replaceVariables(template.html, { recipientName, projectName, projectLink, appName }),
    text: template.text ? replaceVariables(template.text, { recipientName, projectName, projectLink, appName }) : undefined,
  };
}

/**
 * Task Assigned Email Template
 */
export async function getTaskAssignedTemplate(
  recipientName: string,
  taskTitle: string,
  projectName: string,
  assignerName: string,
  taskLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'New Task Assigned: {{taskTitle}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>New Task Assigned</h2>
          <p>Hello {{recipientName}},</p>
          <p>{{assignerName}} has assigned you a new task: <strong>{{taskTitle}}</strong></p>
          <p>Project: {{projectName}}</p>
          <a href="{{taskLink}}" class="button">View Task</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${recipientName},\n\n${assignerName} has assigned you a new task: ${taskTitle}\n\nProject: ${projectName}\n\nView it here: ${taskLink}`,
  };

  const template = await getTemplate('email_task_assigned_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { taskTitle }),
    html: replaceVariables(template.html, { recipientName, taskTitle, projectName, assignerName, taskLink, appName }),
    text: template.text ? replaceVariables(template.text, { recipientName, taskTitle, projectName, assignerName, taskLink, appName }) : undefined,
  };
}

/**
 * Task Updated Email Template
 */
export async function getTaskUpdatedTemplate(
  recipientName: string,
  taskTitle: string,
  projectName: string,
  updateDetails: string,
  taskLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'Task Updated: {{taskTitle}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Task Updated</h2>
          <p>Hello {{recipientName}},</p>
          <p>The task <strong>{{taskTitle}}</strong> in project {{projectName}} has been updated.</p>
          <p>{{updateDetails}}</p>
          <a href="{{taskLink}}" class="button">View Task</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${recipientName},\n\nThe task ${taskTitle} in project ${projectName} has been updated.\n\n${updateDetails}\n\nView it here: ${taskLink}`,
  };

  const template = await getTemplate('email_task_updated_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { taskTitle }),
    html: replaceVariables(template.html, { recipientName, taskTitle, projectName, updateDetails, taskLink, appName }),
    text: template.text ? replaceVariables(template.text, { recipientName, taskTitle, projectName, updateDetails, taskLink, appName }) : undefined,
  };
}

/**
 * Contact Added Email Template
 */
export async function getContactAddedTemplate(
  recipientName: string,
  contactName: string,
  companyName: string,
  contactLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'New Contact Added: {{contactName}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>New Contact Added</h2>
          <p>Hello {{recipientName}},</p>
          <p>A new contact <strong>{{contactName}}</strong> has been added to {{companyName}}.</p>
          <a href="{{contactLink}}" class="button">View Contact</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${recipientName},\n\nA new contact ${contactName} has been added to ${companyName}.\n\nView it here: ${contactLink}`,
  };

  const template = await getTemplate('email_contact_added_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { contactName }),
    html: replaceVariables(template.html, { recipientName, contactName, companyName, contactLink, appName }),
    text: template.text ? replaceVariables(template.text, { recipientName, contactName, companyName, contactLink, appName }) : undefined,
  };
}

/**
 * Company Added Email Template
 */
export async function getCompanyAddedTemplate(
  recipientName: string,
  companyName: string,
  companyLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'New Company Added: {{companyName}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>New Company Added</h2>
          <p>Hello {{recipientName}},</p>
          <p>A new company <strong>{{companyName}}</strong> has been added to your organization.</p>
          <a href="{{companyLink}}" class="button">View Company</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${recipientName},\n\nA new company ${companyName} has been added to your organization.\n\nView it here: ${companyLink}`,
  };

  const template = await getTemplate('email_company_added_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { companyName }),
    html: replaceVariables(template.html, { recipientName, companyName, companyLink, appName }),
    text: template.text ? replaceVariables(template.text, { recipientName, companyName, companyLink, appName }) : undefined,
  };
}

/**
 * Welcome Email Template
 */
export async function getWelcomeTemplate(
  userName: string,
  loginLink: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'Welcome to {{appName}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to {{appName}}!</h2>
          <p>Hello {{userName}},</p>
          <p>Welcome to {{appName}}! We're excited to have you on board.</p>
          <a href="{{loginLink}}" class="button">Get Started</a>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${userName},\n\nWelcome to ${appName}! We're excited to have you on board.\n\nGet started here: ${loginLink}`,
  };

  const template = await getTemplate('email_signup_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: replaceVariables(template.html, { userName, loginLink, appName }),
    text: template.text ? replaceVariables(template.text, { userName, loginLink, appName }) : undefined,
  };
}

