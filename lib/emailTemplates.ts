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
  
  const defaultTemplate: EmailTemplate = {
    subject: 'We\'re Excited to Have You! - Payment Confirmation',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #007bff 0%, #6c757d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .package-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
          .feature-list { list-style: none; padding: 0; }
          .feature-list li { padding: 8px 0; border-bottom: 1px solid #eee; }
          .feature-list li:last-child { border-bottom: none; }
          .feature-list li:before { content: "✓ "; color: #28a745; font-weight: bold; margin-right: 10px; }
          .price { font-size: 24px; font-weight: bold; color: #007bff; margin: 15px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>We're Excited to Have You!</h1>
          </div>
          <div class="content">
            <p>Hello {{userName}},</p>
            <p>Thank you for choosing {{appName}}! We're thrilled that you've selected the <strong>{{packageName}}</strong> plan.</p>
            <p>We'll confirm your account once your payment has been processed. Here are the details of your selected package:</p>
            
            <div class="package-details">
              <h2 style="margin-top: 0;">{{packageName}}</h2>
              <div class="price">{{priceDisplay}}</div>
              <p><strong>Billing Interval:</strong> {{billingInterval}}</p>
              {{quantityDisplay}}
              
              <h3 style="margin-top: 20px;">Package Features:</h3>
              <ul class="feature-list">
                {{features}}
              </ul>
            </div>
            
            <p>You'll receive another email once your payment has been successfully processed with instructions on how to access your account.</p>
            <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
            
            <div class="footer">
              <p>This is an automated message from {{appName}}.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${userName},\n\nThank you for choosing ${appName}! We're thrilled that you've selected the ${packageName} plan.\n\nWe'll confirm your account once your payment has been processed. Here are the details of your selected package:\n\n${packageName}\n${priceDisplay}\nBilling Interval: ${packageDetails.billingInterval}\n${packageDetails.quantity > 1 ? `Number of Users: ${packageDetails.quantity}\n` : ''}\nPackage Features:\n${featuresList.map(f => `✓ ${f}`).join('\n')}\n\nYou'll receive another email once your payment has been successfully processed with instructions on how to access your account.\n\nIf you have any questions, please don't hesitate to reach out to our support team.`,
  };

  const template = await getTemplate('email_pre_payment_confirmation_template', defaultTemplate);
  const featuresHtml = featuresList.map(f => `<li>${f}</li>`).join('');
  const quantityDisplay = packageDetails.quantity > 1 
    ? `<p><strong>Number of Users:</strong> ${packageDetails.quantity}</p>`
    : '';
  
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: replaceVariables(template.html, { 
      userName, 
      appName, 
      packageName,
      priceDisplay,
      billingInterval: packageDetails.billingInterval === 'month' ? 'Monthly' : 'Yearly',
      quantityDisplay,
      features: featuresHtml,
    }),
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
  emailConfirmationLink?: string
): Promise<EmailTemplate> {
  const appName = await getAppName();
  const defaultTemplate: EmailTemplate = {
    subject: 'Welcome to {{appName}} - Your Account is Ready!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to {{appName}}!</h1>
            <p style="margin: 0; font-size: 18px;">Your payment has been processed successfully</p>
          </div>
          <div class="content">
            <p>Hello {{userName}},</p>
            <p>Great news! Your payment has been successfully processed and your account is now active.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">Account Details</h3>
              <p><strong>Organization:</strong> {{organizationName}}</p>
              <p><strong>Plan:</strong> {{packageName}}</p>
            </div>
            
            {{emailConfirmationSection}}
            
            <p>Once your email is confirmed, you can sign in and start using {{appName}}:</p>
            <a href="{{loginLink}}" class="button">Sign In to Your Account</a>
            
            <p>If you have any questions or need assistance getting started, our support team is here to help!</p>
            
            <div class="footer">
              <p>This is an automated message from {{appName}}.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${userName},\n\nGreat news! Your payment has been successfully processed and your account is now active.\n\nAccount Details:\nOrganization: ${organizationName}\nPlan: ${packageName}\n\n${emailConfirmationLink ? `Please confirm your email address to complete your account setup: ${emailConfirmationLink}\n\n` : ''}Once your email is confirmed, you can sign in here: ${loginLink}\n\nIf you have any questions or need assistance getting started, our support team is here to help!`,
  };

  const template = await getTemplate('email_post_payment_welcome_template', defaultTemplate);
  
  // Build email confirmation section (Supabase handles this automatically, so we just mention it)
  const emailConfirmationSection = emailConfirmationLink
    ? `<p><strong>Important:</strong> Please confirm your email address to complete your account setup. Click the link below to verify your email:</p>
       <a href="${emailConfirmationLink}" class="button">Confirm Email Address</a>`
    : `<p><strong>Important:</strong> Please check your email inbox for a confirmation email from Supabase. Click the confirmation link in that email to verify your email address and complete your account setup.</p>`;
  
  return {
    subject: replaceVariables(template.subject, { appName }),
    html: replaceVariables(template.html, { 
      userName, 
      appName, 
      organizationName,
      packageName,
      loginLink,
      emailConfirmationSection,
    }),
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

