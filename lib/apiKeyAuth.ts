import { NextRequest } from 'next/server';
import { validateApiKeyRequest } from './apiKeys';
import { unauthorized, forbidden } from './utils/apiErrors';
import type { ApiKeyContext } from '@/types/apiKeys';

/**
 * Extract API key from request headers
 * Supports both Authorization: Bearer <key> and x-api-key: <key>
 */
export function extractApiKey(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try x-api-key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  return null;
}

/**
 * Authenticate API key from request
 * Returns API key context if valid, null otherwise
 */
export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyContext | null> {
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    return null;
  }
  
  return await validateApiKeyRequest(apiKey);
}

/**
 * Require API key authentication middleware
 * Use this in API routes that require API key auth
 */
export async function requireApiKeyAuth(
  request: NextRequest
): Promise<ApiKeyContext> {
  const context = await authenticateApiKey(request);
  
  if (!context) {
    throw unauthorized('Invalid or missing API key');
  }
  
  return context;
}

/**
 * Get API key context from request (non-throwing)
 * Returns context if valid, null otherwise
 */
export async function getApiKeyContext(request: NextRequest): Promise<ApiKeyContext | null> {
  return await authenticateApiKey(request);
}

