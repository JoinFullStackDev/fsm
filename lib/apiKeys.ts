import crypto from 'crypto';
import { createAdminSupabaseClient } from './supabaseAdmin';
import logger from './utils/logger';
import type { ApiKey, ApiKeyContext, CreateApiKeyRequest } from '@/types/apiKeys';

const API_KEY_PREFIX = 'sk_live_';
const SECRET_LENGTH = 32; // 32 bytes = 64 hex characters

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.API_KEY_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set');
  }
  
  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Generate a random secret portion for an API key
 */
function generateSecret(): string {
  return crypto.randomBytes(SECRET_LENGTH).toString('hex');
}

/**
 * Generate a full API key with prefix and secret
 * @param customPrefix - Optional custom prefix (e.g., "prod", "webhook") - will be sanitized and inserted between prefix and secret
 */
export function generateApiKey(customPrefix?: string | null): string {
  const secret = generateSecret();
  
  if (customPrefix && customPrefix.trim()) {
    // Sanitize prefix: only alphanumeric and underscores, max 20 chars
    const sanitized = customPrefix.trim()
      .replace(/[^a-zA-Z0-9_]/g, '')
      .substring(0, 20)
      .toLowerCase();
    
    if (sanitized) {
      return `${API_KEY_PREFIX}${sanitized}_${secret}`;
    }
  }
  
  return `${API_KEY_PREFIX}${secret}`;
}

/**
 * Extract key_id from full API key
 * Format: sk_live_<secret> or sk_live_<prefix>_<secret>
 */
export function extractKeyId(fullKey: string): string | null {
  if (!fullKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  
  const afterPrefix = fullKey.substring(API_KEY_PREFIX.length);
  
  // Check if it has a custom prefix (contains underscore before secret)
  const underscoreIndex = afterPrefix.indexOf('_');
  if (underscoreIndex > 0 && underscoreIndex < afterPrefix.length - 1) {
    // Has custom prefix: sk_live_<prefix>_<secret>
    const secret = afterPrefix.substring(underscoreIndex + 1);
    if (secret.length === SECRET_LENGTH * 2 && /^[0-9a-f]+$/i.test(secret)) {
      // Use prefix + first 8 chars of secret as key_id
      const prefix = afterPrefix.substring(0, underscoreIndex);
      return `${API_KEY_PREFIX}${prefix}_${secret.substring(0, 8)}`;
    }
  }
  
  // Standard format: sk_live_<secret>
  if (afterPrefix.length === SECRET_LENGTH * 2 && /^[0-9a-f]+$/i.test(afterPrefix)) {
    // Use first 8 characters of secret as key_id for lookup
    return `${API_KEY_PREFIX}${afterPrefix.substring(0, 8)}`;
  }
  
  return null;
}

/**
 * Validate API key format
 * Supports: sk_live_<secret> or sk_live_<prefix>_<secret>
 */
export function validateApiKeyFormat(key: string): boolean {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return false;
  }
  
  const afterPrefix = key.substring(API_KEY_PREFIX.length);
  
  // Check if it has a custom prefix (contains underscore before secret)
  const underscoreIndex = afterPrefix.indexOf('_');
  if (underscoreIndex > 0 && underscoreIndex < afterPrefix.length - 1) {
    // Has custom prefix: sk_live_<prefix>_<secret>
    const secret = afterPrefix.substring(underscoreIndex + 1);
    if (secret.length !== SECRET_LENGTH * 2) {
      return false;
    }
    // Check if secret is valid hex
    return /^[0-9a-f]+$/i.test(secret);
  }
  
  // Standard format: sk_live_<secret>
  if (afterPrefix.length !== SECRET_LENGTH * 2) {
    return false;
  }
  
  // Check if secret is valid hex
  return /^[0-9a-f]+$/i.test(afterPrefix);
}

/**
 * Encrypt API key secret using AES-256-GCM
 */
export function encryptApiKey(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt API key secret
 */
export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }
  
  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash API key secret for comparison (one-way)
 */
export function hashApiKey(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Get API key by key_id (metadata only, no secret)
 */
export async function getApiKeyByKeyId(keyId: string): Promise<ApiKey | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .select('id, key_id, name, scope, organization_id, permissions, status, expires_at, last_used_at, description, created_by, created_at, updated_at')
      .eq('key_id', keyId)
      .single();
    
    if (error || !data) {
      logger.debug('[API Keys] Key not found:', keyId);
      return null;
    }
    
    return data as ApiKey;
  } catch (error) {
    logger.error('[API Keys] Error fetching key:', error);
    return null;
  }
}

/**
 * Validate API key request - check if key is active, not expired, not revoked
 */
export async function validateApiKeyRequest(fullKey: string): Promise<ApiKeyContext | null> {
  try {
    // Extract key_id
    const keyId = extractKeyId(fullKey);
    if (!keyId) {
      logger.debug('[API Keys] Invalid key format');
      return null;
    }
    
    // Get key metadata
    const key = await getApiKeyByKeyId(keyId);
    if (!key) {
      logger.debug('[API Keys] Key not found:', keyId);
      return null;
    }
    
    // Check status
    if (key.status !== 'active') {
      logger.debug('[API Keys] Key is not active:', key.status);
      return null;
    }
    
    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      logger.debug('[API Keys] Key has expired');
      return null;
    }
    
    // Verify secret matches (compare hash)
    // Extract secret portion (everything after the last underscore if custom prefix exists, or everything after prefix)
    let secret: string;
    const afterPrefix = fullKey.substring(API_KEY_PREFIX.length);
    const underscoreIndex = afterPrefix.indexOf('_');
    if (underscoreIndex > 0 && underscoreIndex < afterPrefix.length - SECRET_LENGTH * 2) {
      // Has custom prefix: secret is after the underscore
      secret = afterPrefix.substring(underscoreIndex + 1);
    } else {
      // Standard format: secret is everything after prefix
      secret = afterPrefix;
    }
    const secretHash = hashApiKey(secret);
    
    // Get key_hash from database to compare
    const adminClient = createAdminSupabaseClient();
    const { data: keyHashData, error: hashError } = await adminClient
      .from('api_keys')
      .select('key_hash')
      .eq('id', key.id)
      .single();
    
    if (hashError || !keyHashData) {
      logger.debug('[API Keys] Error fetching key hash');
      return null;
    }
    
    // Compare hashes using constant-time comparison to prevent timing attacks
    const storedHashBuffer = Buffer.from(keyHashData.key_hash, 'hex');
    const computedHashBuffer = Buffer.from(secretHash, 'hex');
    
    // Ensure buffers are same length (should always be true for SHA-256 hashes)
    if (storedHashBuffer.length !== computedHashBuffer.length) {
      logger.debug('[API Keys] Key hash length mismatch');
      return null;
    }
    
    // Use constant-time comparison
    if (!crypto.timingSafeEqual(storedHashBuffer, computedHashBuffer)) {
      logger.debug('[API Keys] Key hash mismatch');
      return null;
    }
    
    // Update last_used_at
    await adminClient
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id);
    
    return {
      apiKeyId: key.id,
      scope: key.scope,
      organizationId: key.organization_id,
      permissions: key.permissions,
    };
  } catch (error) {
    logger.error('[API Keys] Error validating key:', error);
    return null;
  }
}

/**
 * Create API key record in database
 */
export async function createApiKeyRecord(
  request: CreateApiKeyRequest,
  createdBy: string
): Promise<{ fullKey: string; keyRecord: ApiKey }> {
  try {
    // Generate full key with optional custom prefix
    const fullKey = generateApiKey(request.key_prefix);
    
    // Extract secret portion (everything after the last underscore if custom prefix exists, or everything after prefix)
    let secret: string;
    const afterPrefix = fullKey.substring(API_KEY_PREFIX.length);
    const underscoreIndex = afterPrefix.indexOf('_');
    if (underscoreIndex > 0) {
      // Has custom prefix: secret is after the underscore
      secret = afterPrefix.substring(underscoreIndex + 1);
    } else {
      // Standard format: secret is everything after prefix
      secret = afterPrefix;
    }
    
    const keyId = extractKeyId(fullKey);
    
    if (!keyId) {
      throw new Error('Failed to generate key_id');
    }
    
    // Encrypt and hash secret
    const encryptedSecret = encryptApiKey(secret);
    const secretHash = hashApiKey(secret);
    
    // Create record
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .insert({
        key_id: keyId,
        key_hash: secretHash,
        name: request.name,
        scope: request.scope,
        organization_id: request.organization_id || null,
        permissions: request.permissions,
        expires_at: request.expires_at || null,
        description: request.description || null,
        created_by: createdBy,
        status: 'active',
      })
      .select()
      .single();
    
    if (error || !data) {
      logger.error('[API Keys] Error creating key record:', error);
      throw new Error('Failed to create API key record');
    }
    
    return {
      fullKey,
      keyRecord: data as ApiKey,
    };
  } catch (error) {
    logger.error('[API Keys] Error creating key:', error);
    throw error;
  }
}

/**
 * Rotate API key - generate new secret, invalidate old
 * Preserves custom prefix if it exists
 */
export async function rotateApiKey(keyId: string, rotatedBy: string): Promise<{ fullKey: string; keyRecord: ApiKey }> {
  try {
    // Get existing key
    const existingKey = await getApiKeyByKeyId(keyId);
    if (!existingKey) {
      throw new Error('API key not found');
    }
    
    // Extract custom prefix from existing key_id if present
    // key_id format: sk_live_<prefix>_<8chars> or sk_live_<8chars>
    let customPrefix: string | null = null;
    const afterPrefix = existingKey.key_id.substring(API_KEY_PREFIX.length);
    const underscoreIndex = afterPrefix.indexOf('_');
    if (underscoreIndex > 0 && underscoreIndex < afterPrefix.length - 8) {
      // Has custom prefix
      customPrefix = afterPrefix.substring(0, underscoreIndex);
    }
    
    // Generate new key with same prefix
    const fullKey = generateApiKey(customPrefix);
    
    // Extract secret portion
    let secret: string;
    const afterPrefixNew = fullKey.substring(API_KEY_PREFIX.length);
    const underscoreIndexNew = afterPrefixNew.indexOf('_');
    if (underscoreIndexNew > 0) {
      secret = afterPrefixNew.substring(underscoreIndexNew + 1);
    } else {
      secret = afterPrefixNew;
    }
    const newKeyId = extractKeyId(fullKey);
    
    if (!newKeyId) {
      throw new Error('Failed to generate new key_id');
    }
    
    // Encrypt and hash new secret
    const encryptedSecret = encryptApiKey(secret);
    const secretHash = hashApiKey(secret);
    
    const adminClient = createAdminSupabaseClient();
    
    // Update key record with new secret
    const { data, error } = await adminClient
      .from('api_keys')
      .update({
        key_id: newKeyId,
        key_hash: secretHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingKey.id)
      .select()
      .single();
    
    if (error || !data) {
      logger.error('[API Keys] Error rotating key:', error);
      throw new Error('Failed to rotate API key');
    }
    
    return {
      fullKey,
      keyRecord: data as ApiKey,
    };
  } catch (error) {
    logger.error('[API Keys] Error rotating key:', error);
    throw error;
  }
}

/**
 * Revoke API key
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { error } = await adminClient
      .from('api_keys')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('key_id', keyId);
    
    if (error) {
      logger.error('[API Keys] Error revoking key:', error);
      throw new Error('Failed to revoke API key');
    }
  } catch (error) {
    logger.error('[API Keys] Error revoking key:', error);
    throw error;
  }
}

