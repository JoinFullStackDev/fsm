import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/apiKeys';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/global/admin/system/connections/email
 * Update Email (SendGrid) connection configuration (super admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();

    const { api_key, from_email, is_active } = body;

    // Get existing email connection
    const { data: existing, error: fetchError } = await adminClient
      .from('system_connections')
      .select('*')
      .eq('connection_type', 'email')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching email connection:', fetchError);
      return internalError('Failed to fetch email connection', { error: fetchError.message });
    }

    // Validate that API key is provided when creating a new connection
    if (!existing && !api_key) {
      return badRequest('SendGrid API key must be provided when creating a new connection');
    }

    // Build config object - encrypt API key if provided
    const currentConfig = existing?.config || {};
    const updatedConfig: any = {
      ...currentConfig,
    };

    // Update sender email if provided
    if (from_email !== undefined) {
      if (from_email === null || from_email === '') {
        // Remove sender email if explicitly set to empty
        delete updatedConfig.from_email;
        delete updatedConfig.sender_email;
      } else {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(from_email)) {
          return badRequest('Invalid sender email address format');
        }
        updatedConfig.from_email = from_email.trim();
        // Also set sender_email for backward compatibility
        updatedConfig.sender_email = from_email.trim();
      }
    }

    if (api_key !== undefined && api_key !== null && api_key !== '') {
      // Trim whitespace from API key
      const trimmedKey = api_key.trim();
      
      // Validate SendGrid API key format (should start with "SG.")
      if (!trimmedKey.startsWith('SG.')) {
        logger.warn('SendGrid API key does not start with "SG." - may be invalid');
        // Don't fail, but log a warning - let SendGrid API validate it
      }
      
      // Validate minimum length (SendGrid keys are typically 69+ characters)
      if (trimmedKey.length < 20) {
        return badRequest('SendGrid API key appears to be too short. Please check your key.');
      }
      
      try {
        // Encrypt the API key before storing
        const encryptedKey = encryptApiKey(trimmedKey);
        updatedConfig.api_key = encryptedKey;
        logger.info('SendGrid API key encrypted and saved successfully');
      } catch (encryptError) {
        logger.error('Error encrypting SendGrid API key:', encryptError);
        return internalError('Failed to encrypt API key', {
          error: encryptError instanceof Error ? encryptError.message : 'Unknown error',
        });
      }
    }

    const updateData: any = {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    };

    // Automatically activate if API key is provided and is_active not explicitly set
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    } else if (api_key) {
      // If API key is being saved, activate the connection
      updateData.is_active = true;
    }

    if (existing) {
      // Update existing connection
      const { data, error } = await adminClient
        .from('system_connections')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating email connection:', error);
        return internalError('Failed to update email connection', { error: error.message });
      }

      return NextResponse.json({ connection: data });
    } else {
      // Create new connection
      const { data, error } = await adminClient
        .from('system_connections')
        .insert({
          connection_type: 'email',
          config: updatedConfig,
          is_active: is_active !== undefined ? is_active : (api_key ? true : false),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating email connection:', error);
        return internalError('Failed to create email connection', { error: error.message });
      }

      return NextResponse.json({ connection: data });
    }
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/system/connections/email:', error);
    return internalError('Failed to update email connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

