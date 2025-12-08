/**
 * Email service using SendGrid
 * Handles sending emails with encryption for API keys
 */

import sgMail from '@sendgrid/mail';
import { createAdminSupabaseClient } from './supabaseAdmin';
import { encryptApiKey, decryptApiKey } from './apiKeys';
import logger from './utils/logger';
import { getEmailBranding } from './emailBranding';

let sendGridApiKey: string | null = null;
let sendGridInitialized = false;

/**
 * Get SendGrid API key with priority: database (decrypted) > environment variable
 */
export async function getSendGridApiKey(): Promise<string | null> {
  // Priority 1: Check environment variable (for quick setup/deployment)
  const envApiKey = process.env.SENDGRID_API_KEY || process.env.SG_API_KEY || '';
  if (envApiKey && envApiKey.trim()) {
    logger.info('[Email] Using SendGrid API key from environment variable', {
      keyLength: envApiKey.length,
      keyPrefix: envApiKey.substring(0, 3),
    });
    return envApiKey.trim();
  }

  // Priority 2: Check database (encrypted)
  try {
    const adminClient = createAdminSupabaseClient();
    
    logger.debug('[Email] Fetching SendGrid API key from system_connections table', {
      connection_type: 'email',
    });
    
    const { data: connection, error } = await adminClient
      .from('system_connections')
      .select('config, is_active, id')
      .eq('connection_type', 'email')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn('[Email] Email connection not found in database (connection_type=email), falling back to env var', {
          errorCode: error.code,
          errorMessage: error.message,
        });
      } else {
        logger.error('[Email] Error fetching email connection from database:', {
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error,
        });
      }
      return null;
    }

    if (!connection) {
      logger.warn('[Email] Email connection query returned null (connection_type=email)');
      return null;
    }

    logger.debug('[Email] Email connection found', {
      connectionId: connection.id,
      isActive: connection.is_active,
      hasConfig: !!connection.config,
      configKeys: connection.config ? Object.keys(connection.config) : [],
    });

    if (!connection.is_active) {
      logger.warn('[Email] Email connection is not active', {
        connectionId: connection.id,
        isActive: connection.is_active,
      });
      return null;
    }

    const config = connection.config || {};
    const encryptedApiKey = config.api_key;

    logger.debug('[Email] Checking for API key in config', {
      connectionId: connection.id,
      hasApiKey: !!encryptedApiKey,
      apiKeyLength: encryptedApiKey ? String(encryptedApiKey).length : 0,
      configStructure: {
        hasConfig: !!config,
        configType: typeof config,
        configKeys: Object.keys(config),
      },
    });

    if (!encryptedApiKey) {
      logger.warn('[Email] SendGrid API key not found in config.api_key', {
        connectionId: connection.id,
        configKeys: Object.keys(config),
        config: config, // Log full config for debugging (will be redacted in production)
      });
      return null;
    }

    try {
      // Decrypt the API key
      logger.debug('[Email] Decrypting SendGrid API key', {
        connectionId: connection.id,
        encryptedKeyLength: String(encryptedApiKey).length,
      });
      
      const decryptedKey = decryptApiKey(encryptedApiKey);
      
      logger.info('[Email] SendGrid API key successfully retrieved and decrypted from database', {
        connectionId: connection.id,
        decryptedKeyLength: decryptedKey.length,
        keyPrefix: decryptedKey.substring(0, 3), // Log first 3 chars for verification (SG.)
      });
      
      return decryptedKey;
    } catch (decryptError) {
      logger.error('[Email] Error decrypting SendGrid API key:', {
        connectionId: connection.id,
        error: decryptError instanceof Error ? decryptError.message : 'Unknown error',
        stack: decryptError instanceof Error ? decryptError.stack : undefined,
        encryptedKeyLength: String(encryptedApiKey).length,
        encryptedKeyPrefix: String(encryptedApiKey).substring(0, 10), // First 10 chars for debugging
      });
      return null;
    }
  } catch (error) {
    logger.error('[Email] Unexpected error fetching SendGrid API key from database:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Initialize SendGrid with API key from database
 */
async function initializeSendGrid(): Promise<boolean> {
  if (sendGridInitialized && sendGridApiKey) {
    logger.debug('[Email] SendGrid already initialized, reusing existing API key');
    return true;
  }

  logger.info('[Email] Initializing SendGrid - fetching API key (database or env var)');
  const apiKey = await getSendGridApiKey();
  if (!apiKey) {
    logger.error('[Email] Failed to initialize SendGrid - API key not available from database or environment variables');
    return false;
  }

  try {
    logger.debug('[Email] Setting SendGrid API key', {
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 3),
    });
    
    sgMail.setApiKey(apiKey);
    sendGridApiKey = apiKey;
    sendGridInitialized = true;
    
    logger.info('[Email] SendGrid initialized successfully', {
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 3),
    });
    
    return true;
  } catch (error) {
    logger.error('[Email] Error initializing SendGrid:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 3),
    });
    sendGridApiKey = null;
    sendGridInitialized = false;
    return false;
  }
}

/**
 * Get sender email address from database configuration
 */
export async function getSenderEmail(): Promise<string | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    const { data: connection, error } = await adminClient
      .from('system_connections')
      .select('config, is_active')
      .eq('connection_type', 'email')
      .single();

    if (error || !connection || !connection.is_active) {
      return null;
    }

    const config = connection.config || {};
    const senderEmail = config.from_email || config.sender_email;

    if (senderEmail && typeof senderEmail === 'string') {
      logger.debug('[Email] Sender email found in config', {
        senderEmail,
      });
      return senderEmail;
    }

    return null;
  } catch (error) {
    logger.warn('[Email] Error fetching sender email from database:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get sender name from database configuration or generate from organization
 * Format: "{Organization Name} via {App Name}" or just "{App Name}"
 * @param organizationId - Optional organization ID to generate dynamic sender name
 */
export async function getSenderName(organizationId?: string | null): Promise<string> {
  try {
    // First, check if there's a configured sender name in database
    const adminClient = createAdminSupabaseClient();
    const { data: connection } = await adminClient
      .from('system_connections')
      .select('config, is_active')
      .eq('connection_type', 'email')
      .single();

    if (connection?.is_active && connection.config) {
      const senderName = connection.config.sender_name;
      if (senderName && typeof senderName === 'string') {
        logger.debug('[Email] Sender name found in config', {
          senderName,
        });
        return senderName;
      }
    }

    // If organization ID is provided, generate dynamic sender name
    if (organizationId) {
      try {
        const branding = await getEmailBranding(organizationId);
        if (branding.organizationName) {
          const appBranding = await getEmailBranding(null);
          return `${branding.organizationName} via ${appBranding.appName}`;
        }
      } catch (error) {
        logger.debug('[Email] Error generating dynamic sender name, using app name', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Fallback to app name
    const appBranding = await getEmailBranding(null);
    return appBranding.appName;
  } catch (error) {
    logger.warn('[Email] Error fetching sender name, using default:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 'FullStack Method™ App';
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
 * @param fromName - Sender name (optional, will be generated if not provided)
 * @param organizationId - Organization ID for dynamic sender name (optional)
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  from?: string,
  fromName?: string,
  organizationId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const initialized = await initializeSendGrid();
    if (!initialized) {
      return {
        success: false,
        error: 'Email service is not configured',
      };
    }

    // Get sender email: prioritize explicit from param, then database config, then env var, then default
    let senderEmail = from;
    let emailSource = 'explicit';
    
    if (!senderEmail) {
      const dbEmail = await getSenderEmail();
      if (dbEmail) {
        senderEmail = dbEmail;
        emailSource = 'database';
      }
    }
    
    if (!senderEmail) {
      senderEmail = process.env.SENDGRID_FROM_EMAIL;
      if (senderEmail) {
        emailSource = 'env';
      }
    }
    
    if (!senderEmail) {
      senderEmail = 'email@fsm.life';
      emailSource = 'default';
    }

    // Get sender name: prioritize explicit fromName param, then generate from organization, then get from config
    let senderName = fromName;
    if (!senderName) {
      senderName = await getSenderName(organizationId);
    }

    // Format SendGrid from field: "Name <email@domain.com>" or just "email@domain.com" if no name
    const fromField = senderName && senderName !== senderEmail
      ? `${senderName} <${senderEmail}>`
      : senderEmail;

    logger.debug('[Email] Using sender email and name', {
      senderEmail,
      senderName,
      fromField,
      source: emailSource,
    });
    
    const msg = {
      to,
      from: fromField,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
      html,
    };

    const result = await sgMail.send(msg);
    
    logger.info('[Email] Email sent successfully', { 
      to, 
      subject,
      messageId: result[0]?.headers?.['x-message-id'] || 'unknown',
      statusCode: result[0]?.statusCode,
    });
    return { success: true };
  } catch (error) {
    // Get sender email for error logging
    const senderEmail = from || await getSenderEmail() || process.env.SENDGRID_FROM_EMAIL || 'email@fsm.life';
    
    // Type the error for SendGrid-specific properties
    const errorWithResponse = error as { 
      message?: string; 
      code?: string;
      response?: { 
        statusCode?: number; 
        body?: { errors?: Array<{ message?: string; field?: string }> }; 
        headers?: unknown 
      } 
    };
    
    const baseErrorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails: Record<string, unknown> = {
      error: baseErrorMessage,
      to,
      subject,
      from: senderEmail,
    };
    
    // Add SendGrid-specific error details
    if (errorWithResponse.response) {
      errorDetails.statusCode = errorWithResponse.response.statusCode;
      errorDetails.responseBody = errorWithResponse.response.body;
      errorDetails.responseHeaders = errorWithResponse.response.headers;
    }
    
    // Add more detailed error information
    if (errorWithResponse.code) {
      errorDetails.code = errorWithResponse.code;
    }
    
    logger.error('[Email] Error sending email:', errorDetails);
    
    // Provide more specific error message
    let errorMessage = errorWithResponse.message || 'Failed to send email';
    if (errorWithResponse.response?.body?.errors) {
      const sendGridErrors = errorWithResponse.response.body.errors;
      if (Array.isArray(sendGridErrors) && sendGridErrors.length > 0) {
        errorMessage = sendGridErrors.map((e) => e.message || e.field || 'Unknown error').join('; ');
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send email with retry logic
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content (optional)
 * @param from - Sender email address (optional)
 * @param fromName - Sender name (optional)
 * @param organizationId - Organization ID for dynamic sender name (optional)
 * @param maxRetries - Maximum number of retries (default: 2)
 */
export async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  text?: string,
  from?: string,
  fromName?: string,
  organizationId?: string | null,
  maxRetries: number = 2
): Promise<{ success: boolean; error?: string }> {
  let lastError: string | undefined;
  
  logger.info('[Email] Attempting to send email with retry', { 
    to, 
    subject, 
    maxRetries,
    hasHtml: !!html,
    hasText: !!text,
    organizationId,
  });
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      logger.info('[Email] Retrying email send', { 
        attempt, 
        maxAttempts: maxRetries + 1,
        delay,
        to, 
        subject 
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await sendEmail(to, subject, html, text, from, fromName, organizationId);
    if (result.success) {
      logger.info('[Email] Email sent successfully after retry', { 
        attempt: attempt + 1,
        to, 
        subject 
      });
      return result;
    }
    
    lastError = result.error;
    logger.warn('[Email] Email send attempt failed', {
      attempt: attempt + 1,
      maxAttempts: maxRetries + 1,
      error: lastError,
      to,
      subject,
    });
    
    // Don't retry if it's a configuration error
    if (result.error === 'Email service is not configured') {
      logger.error('[Email] Email service not configured, aborting retries', {
        to,
        subject,
      });
      break;
    }
  }

  logger.error('[Email] Failed to send email after all retries', {
    maxRetries,
    finalError: lastError,
    to,
    subject,
  });

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

