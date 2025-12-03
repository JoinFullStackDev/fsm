/**
 * Email template definitions and rendering
 * Uses simple string replacement for variables
 */

import { createAdminSupabaseClient } from './supabaseAdmin';
import logger from './utils/logger';
import { generateEmailWrapper, generateButton, EMAIL_BRAND_COLORS } from './emailTemplateBase';

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
  resetLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">You requested to reset your password for your ${appName} account.</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Click the button below to reset your password:</p>
    ${generateButton('Reset Password', resetLink)}
    <p style="margin: 24px 0 0 0; color: ${EMAIL_BRAND_COLORS.textLight}; font-size: 14px; line-height: 1.6;">This link will expire in 1 hour.</p>
    <p style="margin: 16px 0 0 0; color: ${EMAIL_BRAND_COLORS.textLight}; font-size: 14px; line-height: 1.6;">If you didn't request this password reset, please ignore this email.</p>
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: 'Reset your password' });
  const defaultTemplate: EmailTemplate = {
    subject: 'Reset Your Password',
    html: defaultHtml,
    text: `Hello ${userName},\n\nYou requested to reset your password for your ${appName} account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this password reset, please ignore this email.`,
  };

  const template = await getTemplate('email_password_reset_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { userName, appName }),
    html: template.html,
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
  projectLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">New Project Created</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">${creatorName} has created a new project: <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${projectName}</strong></p>
    ${generateButton('View Project', projectLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `New project: ${projectName}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'New Project Created: {{projectName}}',
    html: defaultHtml,
    text: `Hello ${recipientName},\n\n${creatorName} has created a new project: ${projectName}\n\nView it here: ${projectLink}`,
  };

  const template = await getTemplate('email_project_created_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { projectName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { recipientName, projectName, creatorName, projectLink, appName }) : undefined,
  };
}

/**
 * Project Initiated Email Template
 */
export async function getProjectInitiatedTemplate(
  recipientName: string,
  projectName: string,
  projectLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">Project Management Initiated</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Project management has been initiated for <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${projectName}</strong>.</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Tasks are being generated and the project is ready for management.</p>
    ${generateButton('View Project', projectLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `Project management started: ${projectName}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'Project Management Initiated: {{projectName}}',
    html: defaultHtml,
    text: `Hello ${recipientName},\n\nProject management has been initiated for ${projectName}.\n\nTasks are being generated and the project is ready for management.\n\nView it here: ${projectLink}`,
  };

  const template = await getTemplate('email_project_initiated_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { projectName }),
    html: template.html,
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
  taskLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">New Task Assigned</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">${assignerName} has assigned you a new task: <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${taskTitle}</strong></p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.textLight}; font-size: 14px; line-height: 1.6;">Project: ${projectName}</p>
    ${generateButton('View Task', taskLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `New task: ${taskTitle}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'New Task Assigned: {{taskTitle}}',
    html: defaultHtml,
    text: `Hello ${recipientName},\n\n${assignerName} has assigned you a new task: ${taskTitle}\n\nProject: ${projectName}\n\nView it here: ${taskLink}`,
  };

  let template: EmailTemplate = defaultTemplate;
  try {
    const fetchedTemplate = await getTemplate('email_task_assigned_template', defaultTemplate);
    if (fetchedTemplate && fetchedTemplate.html) {
      template = fetchedTemplate;
    } else {
      logger.warn('[EmailTemplates] Invalid template returned from getTemplate, using default');
    }
  } catch (error) {
    logger.error('[EmailTemplates] Error getting template, using default:', error);
  }
  
  // Ensure we always have valid template properties
  const finalTemplate: EmailTemplate = {
    subject: template?.subject || defaultTemplate.subject,
    html: template?.html || defaultTemplate.html,
    text: template?.text || defaultTemplate.text,
  };
  
  return {
    subject: replaceVariables(finalTemplate.subject, { taskTitle }),
    html: finalTemplate.html,
    text: finalTemplate.text ? replaceVariables(finalTemplate.text, { recipientName, taskTitle, projectName, assignerName, taskLink, appName }) : finalTemplate.text,
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
  taskLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">Task Updated</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">The task <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${taskTitle}</strong> in project ${projectName} has been updated.</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">${updateDetails}</p>
    ${generateButton('View Task', taskLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `Task updated: ${taskTitle}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'Task Updated: {{taskTitle}}',
    html: defaultHtml,
    text: `Hello ${recipientName},\n\nThe task ${taskTitle} in project ${projectName} has been updated.\n\n${updateDetails}\n\nView it here: ${taskLink}`,
  };

  const template = await getTemplate('email_task_updated_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { taskTitle }),
    html: template.html,
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
  contactLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">New Contact Added</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">A new contact <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${contactName}</strong> has been added to ${companyName}.</p>
    ${generateButton('View Contact', contactLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `New contact: ${contactName}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'New Contact Added: {{contactName}}',
    html: defaultHtml,
    text: `Hello ${recipientName},\n\nA new contact ${contactName} has been added to ${companyName}.\n\nView it here: ${contactLink}`,
  };

  const template = await getTemplate('email_contact_added_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { contactName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { recipientName, contactName, companyName, contactLink, appName }) : undefined,
  };
}

/**
 * Company Added Email Template
 */
export async function getCompanyAddedTemplate(
  recipientName: string,
  companyName: string,
  companyLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">New Company Added</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">A new company <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${companyName}</strong> has been added to your organization.</p>
    ${generateButton('View Company', companyLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `New company: ${companyName}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'New Company Added: {{companyName}}',
    html: defaultHtml,
    text: `Hello ${recipientName},\n\nA new company ${companyName} has been added to your organization.\n\nView it here: ${companyLink}`,
  };

  const template = await getTemplate('email_company_added_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { companyName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { recipientName, companyName, companyLink, appName }) : undefined,
  };
}

/**
 * Welcome Email Template
 */
export async function getWelcomeTemplate(
  userName: string,
  loginLink: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">Welcome to ${appName}!</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Welcome to ${appName}! We're excited to have you on board.</p>
    ${generateButton('Get Started', loginLink)}
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: 'Welcome to ' + appName });
  const defaultTemplate: EmailTemplate = {
    subject: 'Welcome to {{appName}}',
    html: defaultHtml,
    text: `Hello ${userName},\n\nWelcome to ${appName}! We're excited to have you on board.\n\nGet started here: ${loginLink}`,
  };

  const template = await getTemplate('email_signup_template', defaultTemplate);
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { userName, loginLink, appName }) : undefined,
  };
}

/**
 * Pre-Payment Confirmation Email Template
 * Sent when user clicks "Continue to Payment"
 */
export async function getPrePaymentConfirmationTemplate(
  userName: string,
  packageName: string,
  packageDetails: {
    pricingModel: 'per_user' | 'flat_rate';
    monthlyPrice: number | null;
    yearlyPrice: number | null;
    billingInterval: 'month' | 'year';
    quantity: number;
    features: {
      maxProjects: number | null;
      maxUsers: number | null;
      maxTemplates: number | null;
      aiFeatures: boolean;
      exportFeatures: boolean;
      opsTool: boolean;
      analytics: boolean;
      apiAccess: boolean;
      customDashboards: boolean;
      supportLevel: string;
    };
  }
): Promise<EmailTemplate> {
  const appName = await getAppName();
  
  const selectedPrice = packageDetails.billingInterval === 'month' 
    ? packageDetails.monthlyPrice 
    : packageDetails.yearlyPrice;
  const totalPrice = packageDetails.pricingModel === 'per_user' && selectedPrice
    ? (selectedPrice * packageDetails.quantity)
    : selectedPrice;
  
  const priceDisplay = packageDetails.pricingModel === 'per_user' && packageDetails.quantity > 1
    ? `$${selectedPrice?.toFixed(2) || '0.00'}/${packageDetails.billingInterval === 'month' ? 'user/mo' : 'user/yr'} × ${packageDetails.quantity} users = $${totalPrice?.toFixed(2) || '0.00'}/${packageDetails.billingInterval === 'month' ? 'mo' : 'yr'}`
    : totalPrice && totalPrice > 0
      ? `$${totalPrice.toFixed(2)}/${packageDetails.billingInterval === 'month' ? 'mo' : 'yr'}`
      : 'Free';
  
  const featuresList: string[] = [];
  if (packageDetails.features.maxProjects !== null) {
    featuresList.push(`${packageDetails.features.maxProjects === -1 ? 'Unlimited' : packageDetails.features.maxProjects} Projects`);
  }
  if (packageDetails.features.maxUsers !== null) {
    featuresList.push(`${packageDetails.features.maxUsers === -1 ? 'Unlimited' : packageDetails.features.maxUsers} Users`);
  }
  if (packageDetails.features.maxTemplates !== null) {
    featuresList.push(`${packageDetails.features.maxTemplates === -1 ? 'Unlimited' : packageDetails.features.maxTemplates} Templates`);
  }
  if (packageDetails.features.aiFeatures) featuresList.push('AI Features');
  if (packageDetails.features.exportFeatures) featuresList.push('Export Features');
  if (packageDetails.features.opsTool) featuresList.push('Ops Tool');
  if (packageDetails.features.analytics) featuresList.push('Analytics');
  if (packageDetails.features.apiAccess) featuresList.push('API Access');
  if (packageDetails.features.customDashboards) featuresList.push('Custom Dashboards');
  featuresList.push(`${packageDetails.features.supportLevel.charAt(0).toUpperCase() + packageDetails.features.supportLevel.slice(1)} Support`);
  
  const featuresHtml = featuresList.map(f => `<li style="padding: 8px 0; border-bottom: 1px solid ${EMAIL_BRAND_COLORS.border}; list-style: none;"><span style="color: ${EMAIL_BRAND_COLORS.success}; font-weight: bold; margin-right: 10px;">✓</span>${f}</li>`).join('');
  const quantityDisplay = packageDetails.quantity > 1 
    ? `<p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Number of Users:</strong> ${packageDetails.quantity}</p>`
    : '';

  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">We're Excited to Have You!</h2>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Thank you for choosing ${appName}! We're thrilled that you've selected the <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${packageName}</strong> plan.</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">We'll confirm your account once your payment has been processed. Here are the details of your selected package:</p>
    
    <div style="background: ${EMAIL_BRAND_COLORS.white}; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${EMAIL_BRAND_COLORS.primary};">
      <h3 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 20px; font-weight: 600;">${packageName}</h3>
      <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_BRAND_COLORS.primary}; margin: 15px 0;">${priceDisplay}</div>
      <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Billing Interval:</strong> ${packageDetails.billingInterval === 'month' ? 'Monthly' : 'Yearly'}</p>
      ${quantityDisplay}
      
      <h4 style="margin-top: 20px; margin-bottom: 12px; color: ${EMAIL_BRAND_COLORS.text}; font-size: 18px; font-weight: 600;">Package Features:</h4>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${featuresHtml}
      </ul>
    </div>
    
    <p style="margin: 24px 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">You'll receive another email once your payment has been successfully processed with instructions on how to access your account.</p>
    <p style="margin: 0 0 0 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">If you have any questions, please don't hesitate to reach out to our support team.</p>
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId: null, preheader: `Payment confirmation for ${packageName}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'We\'re Excited to Have You! - Payment Confirmation',
    html: defaultHtml,
    text: `Hello ${userName},\n\nThank you for choosing ${appName}! We're thrilled that you've selected the ${packageName} plan.\n\nWe'll confirm your account once your payment has been processed. Here are the details of your selected package:\n\n${packageName}\n${priceDisplay}\nBilling Interval: ${packageDetails.billingInterval}\n${packageDetails.quantity > 1 ? `Number of Users: ${packageDetails.quantity}\n` : ''}\nPackage Features:\n${featuresList.map(f => `✓ ${f}`).join('\n')}\n\nYou'll receive another email once your payment has been successfully processed with instructions on how to access your account.\n\nIf you have any questions, please don't hesitate to reach out to our support team.`,
  };

  const template = await getTemplate('email_pre_payment_confirmation_template', defaultTemplate);
  
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { 
      userName, 
      appName, 
      packageName,
      priceDisplay,
      billingInterval: packageDetails.billingInterval === 'month' ? 'Monthly' : 'Yearly',
      quantity: packageDetails.quantity > 1 ? String(packageDetails.quantity) : '',
    }) : undefined,
  };
}

/**
 * Post-Payment Welcome Email Template
 * Sent after successful payment
 */
export async function getPostPaymentWelcomeTemplate(
  userName: string,
  organizationName: string,
  packageName: string,
  loginLink: string,
  emailConfirmationLink?: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  
  // Build email confirmation section
  const emailConfirmationSection = emailConfirmationLink
    ? `<p style="margin: 24px 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Important:</strong> Please confirm your email address to complete your account setup. Click the button below to verify your email:</p>
       ${generateButton('Confirm Email Address', emailConfirmationLink, EMAIL_BRAND_COLORS.success)}`
    : `<p style="margin: 24px 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Important:</strong> Please check your email inbox for a confirmation email from Supabase. Click the confirmation link in that email to verify your email address and complete your account setup.</p>`;

  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.success}; font-size: 24px; font-weight: 600;">Welcome to ${appName}!</h2>
    <p style="margin: 8px 0 24px 0; color: ${EMAIL_BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">Your payment has been processed successfully</p>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Great news! Your payment has been successfully processed and your account is now active.</p>
    
    <div style="background: ${EMAIL_BRAND_COLORS.white}; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${EMAIL_BRAND_COLORS.success};">
      <h3 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 18px; font-weight: 600;">Account Details</h3>
      <p style="margin: 0 0 8px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Organization:</strong> ${organizationName}</p>
      <p style="margin: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Plan:</strong> ${packageName}</p>
    </div>
    
    ${emailConfirmationSection}
    
    <p style="margin: 24px 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Once your email is confirmed, you can sign in and start using ${appName}:</p>
    ${generateButton('Sign In to Your Account', loginLink)}
    
    <p style="margin: 24px 0 0 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">If you have any questions or need assistance getting started, our support team is here to help!</p>
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: 'Your account is ready!' });
  const defaultTemplate: EmailTemplate = {
    subject: 'Welcome to {{appName}} - Your Account is Ready!',
    html: defaultHtml,
    text: `Hello ${userName},\n\nGreat news! Your payment has been successfully processed and your account is now active.\n\nAccount Details:\nOrganization: ${organizationName}\nPlan: ${packageName}\n\n${emailConfirmationLink ? `Please confirm your email address to complete your account setup: ${emailConfirmationLink}\n\n` : ''}Once your email is confirmed, you can sign in here: ${loginLink}\n\nIf you have any questions or need assistance getting started, our support team is here to help!`,
  };

  const template = await getTemplate('email_post_payment_welcome_template', defaultTemplate);
  
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { 
      userName, 
      appName, 
      organizationName,
      packageName,
      loginLink,
      emailConfirmationLink: emailConfirmationLink || '',
    }) : undefined,
  };
}

/**
 * User Invitation Email Template
 * Sent when an admin creates a new user account
 */
export async function getUserInvitationTemplate(
  userName: string,
  organizationName: string,
  invitationLink: string,
  adminName?: string,
  organizationId?: string | null
): Promise<EmailTemplate> {
  const appName = await getAppName();
  
  const invitationText = adminName 
    ? `${adminName} has invited you to join <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${organizationName}</strong> on ${appName}.`
    : `You've been invited to join <strong style="color: ${EMAIL_BRAND_COLORS.primary}; font-weight: 600;">${organizationName}</strong> on ${appName}.`;

  const content = `
    <h2 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 24px; font-weight: 600;">You've been invited!</h2>
    <p style="margin: 8px 0 24px 0; color: ${EMAIL_BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">Join ${organizationName} on ${appName}</p>
    <p style="margin: 0 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
    <p style="margin: 0 0 24px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">${invitationText}</p>
    
    <div style="background: ${EMAIL_BRAND_COLORS.white}; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${EMAIL_BRAND_COLORS.primary};">
      <h3 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 18px; font-weight: 600;">What's next?</h3>
      <p style="margin: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">Click the button below to confirm your email address and set up your account password. This will complete your account setup and allow you to sign in.</p>
    </div>
    
    ${generateButton('Confirm Email & Set Password', invitationLink)}
    
    <p style="margin: 24px 0 16px 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;"><strong>Important:</strong> This invitation link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
    
    <p style="margin: 0; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">If you have any questions, please contact your organization administrator.</p>
  `;

  const defaultHtml = await generateEmailWrapper({ content, organizationId, preheader: `Join ${organizationName} on ${appName}` });
  const defaultTemplate: EmailTemplate = {
    subject: 'You\'ve been invited to join {{appName}}',
    html: defaultHtml,
    text: `Hello ${userName},\n\n${adminName ? `${adminName} has invited you to join ${organizationName} on ${appName}.` : `You've been invited to join ${organizationName} on ${appName}.`}\n\nClick the link below to confirm your email address and set up your account password:\n\n${invitationLink}\n\nThis invitation link will expire in 24 hours.\n\nIf you didn't expect this invitation, you can safely ignore this email.\n\nIf you have any questions, please contact your organization administrator.`,
  };

  const template = await getTemplate('email_user_invitation_template', defaultTemplate);
  
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: template.html,
    text: template.text ? replaceVariables(template.text, { 
      userName, 
      appName, 
      organizationName,
      invitationLink,
    }) : undefined,
  };
}

