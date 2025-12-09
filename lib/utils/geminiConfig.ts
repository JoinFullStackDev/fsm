/**
 * Get Gemini API configuration with priority:
 * 1. Environment variable (GOOGLE_GENAI_API_KEY or GEMINI_API_KEY) - super admin's credentials
 * 2. Admin settings database (fallback)
 * 
 * This ensures everyone uses the super admin's API credentials from environment variables
 */

import type { AdminSetting } from '@/types/project';
import logger from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptApiKey } from '@/lib/apiKeys';

/**
 * Check if a value looks like an encrypted key (format: iv:authTag:data)
 */
function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}

/**
 * Decrypt key if encrypted, otherwise return as-is (for backward compatibility)
 */
function decryptIfNeeded(key: string): string {
  if (isEncrypted(key)) {
    try {
      const decrypted = decryptApiKey(key);
      logger.debug('[Gemini Config] Successfully decrypted API key from database');
      return decrypted;
    } catch (error) {
      logger.error('[Gemini Config] Failed to decrypt key, returning as-is:', error);
      return key;
    }
  }
  return key;
}

export interface GeminiConfig {
  enabled: boolean;
  apiKey: string | null;
  projectName?: string;
}

/**
 * Get Gemini API key with priority: env var > admin_settings
 */
export async function getGeminiApiKey(supabase: SupabaseClient): Promise<string | null> {
  // Priority 1: Use environment variable (super admin's credentials)
  const envApiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  if (envApiKey) {
    logger.debug('[Gemini Config] Using API key from environment variable (super admin credentials)');
    return envApiKey.trim();
  }

  // Priority 2: Fallback to admin_settings
  try {
    const { API_CONFIG_KEYS } = await import('@/lib/constants');
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', [API_CONFIG_KEYS.GEMINI_KEY, API_CONFIG_KEYS.GEMINI_KEY_ALT]);

    if (error) {
      logger.error('Error fetching Gemini API key from database:', error);
      return null;
    }

    const settings = data as AdminSetting[];
    const keySetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_KEY || s.key === API_CONFIG_KEYS.GEMINI_KEY_ALT);

    if (keySetting?.value) {
      let apiKey = String(keySetting.value);
      apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
      
      // Decrypt if the key is encrypted (provides backward compatibility)
      apiKey = decryptIfNeeded(apiKey);
      
      logger.debug('[Gemini Config] Using API key from admin_settings');
      return apiKey;
    }
  } catch (error) {
    logger.error('Error in getGeminiApiKey:', error);
  }

  return null;
}

/**
 * Get full Gemini configuration (enabled status, API key, project name)
 */
export async function getGeminiConfig(supabase: SupabaseClient): Promise<GeminiConfig | null> {
  const { API_CONFIG_KEYS } = await import('@/lib/constants');
  
  // Priority 1: Use environment variable (super admin's credentials)
  const envApiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  let apiKey: string | null = null;
  let enabled = true;
  let projectName: string | undefined = undefined;
  
  if (envApiKey) {
    // Use environment variable (super admin's credentials)
    apiKey = envApiKey.trim();
    logger.debug('[Gemini Config] Using API key from environment variable (super admin credentials)');
  } else {
    // Priority 2: Fallback to admin_settings
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', [API_CONFIG_KEYS.GEMINI_KEY, API_CONFIG_KEYS.GEMINI_KEY_ALT, API_CONFIG_KEYS.GEMINI_ENABLED, API_CONFIG_KEYS.GEMINI_PROJECT_NAME]);

    if (error) {
      logger.error('Error fetching Gemini config:', error);
      return null;
    }

    const settings = data as AdminSetting[];
    const keySetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_KEY || s.key === API_CONFIG_KEYS.GEMINI_KEY_ALT);
    const enabledSetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_ENABLED);
    const projectNameSetting = settings.find(s => s.key === API_CONFIG_KEYS.GEMINI_PROJECT_NAME);

    enabled = enabledSetting?.value !== undefined ? Boolean(enabledSetting.value) : true;
    // Clean API key - remove quotes if stored as JSON string
    apiKey = keySetting?.value ? String(keySetting.value) : null;
    if (apiKey) {
      apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
      
      // Decrypt if the key is encrypted (provides backward compatibility)
      apiKey = decryptIfNeeded(apiKey);
      
      // Log API key retrieval for debugging (masked)
      logger.debug('[Gemini Config] API key retrieved from database');
      logger.debug('[Gemini Config] Key length:', apiKey.length);
      logger.debug('[Gemini Config] Starts with AIza:', apiKey.startsWith('AIza'));
      
      // Warn if key format looks wrong (after decryption)
      if (!apiKey.startsWith('AIza')) {
        logger.warn('[Gemini Config] ⚠️  API key does not start with "AIza" - unusual format');
      }
    }
    projectName = projectNameSetting?.value ? String(projectNameSetting.value) : undefined;
  }

  return { enabled, apiKey, projectName };
}

