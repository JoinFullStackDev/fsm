/**
 * Webhook Action
 * Make outgoing HTTP calls to external services
 */

import { interpolateTemplate, interpolateObject } from '../templating';
import type { WebhookCallConfig, WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

// Default timeout for webhook calls (10 seconds)
const DEFAULT_TIMEOUT_MS = 10000;

// Maximum timeout allowed (30 seconds)
const MAX_TIMEOUT_MS = 30000;

/**
 * Execute webhook call action
 * 
 * @param config - Webhook configuration
 * @param context - Workflow context
 * @returns Action result with response data
 */
export async function executeWebhookCall(
  config: WebhookCallConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const webhookConfig = config as WebhookCallConfig;
  
  // Interpolate the URL
  const url = interpolateTemplate(webhookConfig.url, context);
  
  // Validate URL
  if (!isValidUrl(url)) {
    throw new Error(`Invalid webhook URL: ${url}`);
  }
  
  // Block internal URLs for security
  if (isInternalUrl(url)) {
    throw new Error('Webhook calls to internal URLs are not allowed');
  }
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'FSM-Workflow/1.0',
  };
  
  // Add custom headers (interpolated)
  if (webhookConfig.headers) {
    for (const [key, value] of Object.entries(webhookConfig.headers)) {
      // Don't allow overriding certain headers
      if (!['host', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = interpolateTemplate(value, context);
      }
    }
  }
  
  // Build body for non-GET requests
  let body: string | undefined;
  if (webhookConfig.body_template && webhookConfig.method !== 'GET') {
    const interpolated = interpolateTemplate(webhookConfig.body_template, context);
    // Try to parse and re-stringify to validate JSON
    try {
      const parsed = JSON.parse(interpolated);
      body = JSON.stringify(parsed);
    } catch {
      // If not valid JSON, wrap it
      body = JSON.stringify({ data: interpolated });
    }
  } else if (webhookConfig.method !== 'GET') {
    // Send context data as body by default for POST/PUT/PATCH
    body = JSON.stringify({
      trigger: context.trigger,
      organization_id: context.organization_id,
      triggered_at: context.triggered_at,
    });
  }
  
  // Calculate timeout
  const timeout = Math.min(
    webhookConfig.timeout_ms || DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );
  
  logger.info('[Webhook] Calling external URL:', {
    url: url.substring(0, 100),
    method: webhookConfig.method,
    hasBody: !!body,
    timeout,
  });
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: webhookConfig.method,
      headers,
      body,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Parse response
    let responseData: unknown;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }
    
    logger.info('[Webhook] Response received:', {
      statusCode: response.status,
      success: response.ok,
      contentType,
    });
    
    // Build output
    const output: Record<string, unknown> = {
      success: response.ok,
      status_code: response.status,
      status_text: response.statusText,
      called_at: new Date().toISOString(),
    };
    
    // Store response in specified field
    if (webhookConfig.output_field) {
      output[webhookConfig.output_field] = responseData;
    } else {
      output.response = responseData;
    }
    
    // Log warning for non-2xx responses
    if (!response.ok) {
      logger.warn('[Webhook] Non-OK response:', {
        statusCode: response.status,
        url: url.substring(0, 100),
      });
    }
    
    return { output };
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('[Webhook] Request timed out:', {
        url: url.substring(0, 100),
        timeout,
      });
      throw new Error(`Webhook request timed out after ${timeout}ms`);
    }
    
    logger.error('[Webhook] Request failed:', {
      url: url.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Check if URL points to internal/localhost
 */
function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and common internal patterns
    const internalPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.',
      '10.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
      '192.168.',
    ];
    
    return internalPatterns.some(pattern => 
      hostname === pattern || hostname.startsWith(pattern)
    );
  } catch {
    return true; // Block invalid URLs
  }
}

