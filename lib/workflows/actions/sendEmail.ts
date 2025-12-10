/**
 * Send Email Action
 * Sends emails via the existing SendGrid service
 */

import { sendEmail } from '@/lib/emailService';
import { interpolateTemplate } from '../templating';
import type { SendEmailConfig, WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute send email action
 * 
 * @param config - Email configuration
 * @param context - Workflow context
 * @returns Action result with email details
 */
export async function executeSendEmail(
  config: SendEmailConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const emailConfig = config as SendEmailConfig;
  
  // Interpolate template variables
  const to = interpolateTemplate(emailConfig.to, context);
  const subject = interpolateTemplate(emailConfig.subject, context);
  const bodyHtml = interpolateTemplate(emailConfig.body_html, context);
  const bodyText = emailConfig.body_text 
    ? interpolateTemplate(emailConfig.body_text, context)
    : undefined;
  const fromName = emailConfig.from_name
    ? interpolateTemplate(emailConfig.from_name, context)
    : undefined;
  
  // Validate email address
  if (!to || !isValidEmail(to)) {
    logger.warn('[SendEmail] Invalid or empty recipient email:', { to });
    return {
      output: {
        success: false,
        error: 'Invalid or empty recipient email address',
        to,
      },
    };
  }
  
  logger.info('[SendEmail] Sending email:', {
    to,
    subject,
    organizationId: context.organization_id,
  });
  
  try {
    const result = await sendEmail(
      to,
      subject,
      bodyHtml,
      bodyText,
      undefined, // from email (uses default)
      fromName,
      context.organization_id
    );
    
    if (!result.success) {
      logger.error('[SendEmail] Failed to send email:', {
        to,
        error: result.error,
      });
      throw new Error(result.error || 'Failed to send email');
    }
    
    logger.info('[SendEmail] Email sent successfully:', { to, subject });
    
    return {
      output: {
        success: true,
        sent_to: to,
        subject,
        sent_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[SendEmail] Error sending email:', {
      to,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

