/**
 * Email service using SendGrid
 * Handles sending emails with encryption for API keys
 */

import sgMail from '@sendgrid/mail';
import { createAdminSupabaseClient } from './supabaseAdmin';
import { encryptApiKey, decryptApiKey } from './apiKeys';
import logger from './utils/logger';

let sendGridApiKey: string | null = null;
let sendGridInitialized = false;

/**
 * Get SendGrid API key from database (decrypted)
 */
export async function getSendGridApiKey(): Promise<string | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    const { data: connection, error } = await adminClient
      .from('system_connections')
      .select('config, is_active')
      .eq('connection_type', 'email')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        logger.debug('[Email] Email connection not found in database');
      } else {
        logger.error('[Email] Error fetching email connection from database:', error);
      }
      return null;
    }

    if (!connection) {
      logger.debug('[Email] Email connection not found in database');
      return null;
    }

    if (!connection.is_active) {
      logger.warn('[Email] Email connection is not active');
      return null;
    }

    const config = connection.config || {};
    const encryptedApiKey = config.api_key;

    if (!encryptedApiKey) {
      logger.warn('[Email] SendGrid API key not configured in database');
      return null;
    }

    try {
      // Decrypt the API key
      const decryptedKey = decryptApiKey(encryptedApiKey);
      return decryptedKey;
    } catch (decryptError) {
      logger.error('[Email] Error decrypting SendGrid API key:', decryptError);
      return null;
    }
  } catch (error) {
    logger.error('[Email] Error fetching SendGrid API key from database:', error);
    return null;
  }
}

/**
 * Initialize SendGrid with API key from database
 */
async function initializeSendGrid(): Promise<boolean> {
  if (sendGridInitialized && sendGridApiKey) {
    return true;
  }

  const apiKey = await getSendGridApiKey();
  if (!apiKey) {
    return false;
  }

  try {
    sgMail.setApiKey(apiKey);
    sendGridApiKey = apiKey;
    sendGridInitialized = true;
    return true;
  } catch (error) {
    logger.error('[Email] Error initializing SendGrid:', error);
    return false;
  }
}

/**
 * Check if email service is configured and active
 */
export async function isEmailConfigured(): Promise<boolean> {
  const apiKey = await getSendGridApiKey();
  return !!apiKey;
}

/**
 * Send an email using SendGrid
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content (optional)
 * @param from - Sender email address (optional, defaults to system email)
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  from?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const initialized = await initializeSendGrid();
    if (!initialized) {
      return {
        success: false,
        error: 'Email service is not configured',
      };
    }

    // Get default from email from admin settings or use a default
    const defaultFrom = from || process.env.SENDGRID_FROM_EMAIL || 'noreply@fullstackmethod.com';
    
    const msg = {
      to,
      from: defaultFrom,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
      html,
    };

    await sgMail.send(msg);
    
    logger.debug('[Email] Email sent successfully', { to, subject });
    return { success: true };
  } catch (error: any) {
    logger.error('[Email] Error sending email:', {
      error: error.message,
      to,
      subject,
      response: error.response?.body,
    });
    
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Send email with retry logic
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content (optional)
 * @param maxRetries - Maximum number of retries (default: 2)
 */
export async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  text?: string,
  maxRetries: number = 2
): Promise<{ success: boolean; error?: string }> {
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug('[Email] Retrying email send', { attempt, to, subject });
    }

    const result = await sendEmail(to, subject, html, text);
    if (result.success) {
      return result;
    }
    
    lastError = result.error;
    
    // Don't retry if it's a configuration error
    if (result.error === 'Email service is not configured') {
      break;
    }
  }

  return {
    success: false,
    error: lastError || 'Failed to send email after retries',
  };
}

/**
 * Reset SendGrid initialization (useful for testing or when API key changes)
 */
export function resetSendGridInitialization(): void {
  sendGridApiKey = null;
  sendGridInitialized = false;
}

