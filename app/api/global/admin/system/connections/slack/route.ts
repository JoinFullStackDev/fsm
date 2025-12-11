import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/apiKeys';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { DEFAULT_SLACK_SCOPES } from '@/types/integrations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/system/connections/slack
 * Get Slack connection configuration (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: connection, error } = await adminClient
      .from('system_connections')
      .select('*')
      .eq('connection_type', 'slack')
      .maybeSingle();

    if (error) {
      logger.error('Error fetching Slack connection:', error);
      return internalError('Failed to fetch Slack connection', { error: error.message });
    }

    // Return sanitized config (don't expose actual secrets)
    if (connection?.config) {
      const config = connection.config as Record<string, unknown>;
      return NextResponse.json({
        connection: {
          ...connection,
          config: {
            client_id: config.client_id || '',
            has_client_secret: !!config.client_secret,
            has_signing_secret: !!config.signing_secret,
            enabled_for_organizations: config.enabled_for_organizations !== false,
            scopes: config.scopes || DEFAULT_SLACK_SCOPES,
          },
        },
      });
    }

    return NextResponse.json({ connection: null });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/system/connections/slack:', error);
    return internalError('Failed to fetch Slack connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/global/admin/system/connections/slack
 * Update Slack connection configuration (super admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();

    const { 
      client_id, 
      client_secret, 
      signing_secret, 
      enabled_for_organizations,
      scopes,
      is_active 
    } = body;

    // Get existing Slack connection
    const { data: existing, error: fetchError } = await adminClient
      .from('system_connections')
      .select('*')
      .eq('connection_type', 'slack')
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching Slack connection:', fetchError);
      return internalError('Failed to fetch Slack connection', { error: fetchError.message });
    }

    // Validate that client_id is provided when creating a new connection
    if (!existing && !client_id) {
      return badRequest('Slack Client ID must be provided when creating a new connection');
    }

    // Build config object - encrypt secrets if provided
    const currentConfig = (existing?.config || {}) as Record<string, unknown>;
    const updatedConfig: Record<string, unknown> = {
      ...currentConfig,
    };

    // Update client_id if provided
    if (client_id !== undefined) {
      if (client_id === null || client_id === '') {
        delete updatedConfig.client_id;
      } else {
        updatedConfig.client_id = client_id.trim();
      }
    }

    // Encrypt and store client_secret if provided
    if (client_secret !== undefined && client_secret !== null && client_secret !== '') {
      const trimmedSecret = client_secret.trim();
      
      // Basic validation for Slack client secrets
      if (trimmedSecret.length < 10) {
        return badRequest('Slack Client Secret appears to be too short. Please check your secret.');
      }
      
      try {
        const encryptedSecret = encryptApiKey(trimmedSecret);
        updatedConfig.client_secret = encryptedSecret;
        logger.info('Slack Client Secret encrypted and saved successfully');
      } catch (encryptError) {
        logger.error('Error encrypting Slack Client Secret:', encryptError);
        return internalError('Failed to encrypt Client Secret', {
          error: encryptError instanceof Error ? encryptError.message : 'Unknown error',
        });
      }
    }

    // Encrypt and store signing_secret if provided
    if (signing_secret !== undefined && signing_secret !== null && signing_secret !== '') {
      const trimmedSecret = signing_secret.trim();
      
      if (trimmedSecret.length < 10) {
        return badRequest('Slack Signing Secret appears to be too short. Please check your secret.');
      }
      
      try {
        const encryptedSecret = encryptApiKey(trimmedSecret);
        updatedConfig.signing_secret = encryptedSecret;
        logger.info('Slack Signing Secret encrypted and saved successfully');
      } catch (encryptError) {
        logger.error('Error encrypting Slack Signing Secret:', encryptError);
        return internalError('Failed to encrypt Signing Secret', {
          error: encryptError instanceof Error ? encryptError.message : 'Unknown error',
        });
      }
    }

    // Update enabled_for_organizations flag
    if (enabled_for_organizations !== undefined) {
      updatedConfig.enabled_for_organizations = enabled_for_organizations === true;
    }

    // Update scopes if provided
    if (scopes !== undefined) {
      if (Array.isArray(scopes)) {
        updatedConfig.scopes = scopes;
      } else {
        updatedConfig.scopes = DEFAULT_SLACK_SCOPES;
      }
    }

    const updateData: { 
      config: Record<string, unknown>; 
      updated_at: string; 
      is_active?: boolean;
    } = {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    };

    // Handle is_active flag
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    } else if (client_id && client_secret) {
      // Automatically activate if both client_id and client_secret are provided
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
        logger.error('Error updating Slack connection:', error);
        return internalError('Failed to update Slack connection', { error: error.message });
      }

      // Return sanitized response
      const config = data.config as Record<string, unknown>;
      return NextResponse.json({
        connection: {
          ...data,
          config: {
            client_id: config.client_id || '',
            has_client_secret: !!config.client_secret,
            has_signing_secret: !!config.signing_secret,
            enabled_for_organizations: config.enabled_for_organizations !== false,
            scopes: config.scopes || DEFAULT_SLACK_SCOPES,
          },
        },
      });
    } else {
      // Create new connection
      const { data, error } = await adminClient
        .from('system_connections')
        .insert({
          connection_type: 'slack',
          config: updatedConfig,
          is_active: is_active !== undefined ? is_active : !!(client_id && client_secret),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating Slack connection:', error);
        return internalError('Failed to create Slack connection', { error: error.message });
      }

      // Return sanitized response
      const config = data.config as Record<string, unknown>;
      return NextResponse.json({
        connection: {
          ...data,
          config: {
            client_id: config.client_id || '',
            has_client_secret: !!config.client_secret,
            has_signing_secret: !!config.signing_secret,
            enabled_for_organizations: config.enabled_for_organizations !== false,
            scopes: config.scopes || DEFAULT_SLACK_SCOPES,
          },
        },
      });
    }
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/system/connections/slack:', error);
    return internalError('Failed to update Slack connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
