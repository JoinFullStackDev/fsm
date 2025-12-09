import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/apiKeys';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { API_CONFIG_KEYS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/system/ai
 * Get AI configuration settings (super admin only)
 * Returns whether keys are configured, not actual keys
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: settings, error } = await adminClient
      .from('admin_settings')
      .select('key, value, category')
      .in('key', [
        API_CONFIG_KEYS.GEMINI_KEY,
        API_CONFIG_KEYS.GEMINI_KEY_ALT,
        API_CONFIG_KEYS.GEMINI_ENABLED,
        API_CONFIG_KEYS.GEMINI_PROJECT_NAME,
      ]);

    if (error) {
      logger.error('Error fetching AI config:', error);
      return internalError('Failed to fetch AI configuration');
    }

    // Build response (never expose actual API keys)
    const keySetting = settings?.find(
      s => s.key === API_CONFIG_KEYS.GEMINI_KEY || s.key === API_CONFIG_KEYS.GEMINI_KEY_ALT
    );
    const enabledSetting = settings?.find(s => s.key === API_CONFIG_KEYS.GEMINI_ENABLED);
    const projectNameSetting = settings?.find(s => s.key === API_CONFIG_KEYS.GEMINI_PROJECT_NAME);

    return NextResponse.json({
      gemini: {
        has_api_key: !!keySetting?.value,
        enabled: enabledSetting?.value !== undefined ? Boolean(enabledSetting.value) : true,
        project_name: projectNameSetting?.value ? String(projectNameSetting.value) : null,
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/system/ai:', error);
    return internalError('Failed to fetch AI configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/global/admin/system/ai
 * Update AI configuration settings (super admin only)
 * Encrypts API keys before storing
 */
export async function PUT(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();

    const { gemini_api_key, gemini_enabled, gemini_project_name } = body;

    const updates: Array<{
      key: string;
      value: string | boolean;
      category: string;
      updated_by: string;
      updated_at: string;
    }> = [];

    // Process Gemini API key (encrypt before storing)
    if (gemini_api_key !== undefined && gemini_api_key !== null && gemini_api_key !== '') {
      const trimmedKey = gemini_api_key.trim();
      
      // Basic validation
      if (trimmedKey.length < 20) {
        return badRequest('API key appears to be too short');
      }

      try {
        const encryptedKey = encryptApiKey(trimmedKey);
        updates.push({
          key: API_CONFIG_KEYS.GEMINI_KEY,
          value: encryptedKey,
          category: 'api',
          updated_by: superAdmin.userId,
          updated_at: new Date().toISOString(),
        });
        logger.info('Gemini API key encrypted and will be saved');
      } catch (encryptError) {
        logger.error('Error encrypting Gemini API key:', encryptError);
        return internalError('Failed to encrypt API key');
      }
    }

    // Process enabled flag
    if (gemini_enabled !== undefined) {
      updates.push({
        key: API_CONFIG_KEYS.GEMINI_ENABLED,
        value: gemini_enabled,
        category: 'api',
        updated_by: superAdmin.userId,
        updated_at: new Date().toISOString(),
      });
    }

    // Process project name
    if (gemini_project_name !== undefined) {
      updates.push({
        key: API_CONFIG_KEYS.GEMINI_PROJECT_NAME,
        value: gemini_project_name || '',
        category: 'api',
        updated_by: superAdmin.userId,
        updated_at: new Date().toISOString(),
      });
    }

    if (updates.length === 0) {
      return badRequest('No settings to update');
    }

    // Upsert all settings
    for (const update of updates) {
      const { error: updateError } = await adminClient
        .from('admin_settings')
        .upsert(update, { onConflict: 'key' });

      if (updateError) {
        logger.error('Error saving AI config setting:', updateError);
        return internalError('Failed to save AI configuration');
      }
    }

    logger.info('AI configuration saved successfully');
    return NextResponse.json({ success: true, message: 'AI configuration saved successfully' });
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/system/ai:', error);
    return internalError('Failed to save AI configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

