import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/global/admin/system/connections/stripe
 * Update Stripe connection configuration (super admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();

    const {
      test_secret_key,
      test_publishable_key,
      live_secret_key,
      live_publishable_key,
      test_mode,
      is_active,
    } = body;

    // Get existing Stripe connection
    const { data: existing, error: fetchError } = await adminClient
      .from('system_connections')
      .select('*')
      .eq('connection_type', 'stripe')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching Stripe connection:', fetchError);
      return internalError('Failed to fetch Stripe connection', { error: fetchError.message });
    }

    // Validate that at least one key is provided when creating a new connection
    if (!existing && !test_secret_key && !live_secret_key) {
      return badRequest('At least one secret key (test or live) must be provided when creating a new connection');
    }

    // Build config object - only update keys that are provided
    const currentConfig = existing?.config || {};
    const updatedConfig = {
      ...currentConfig,
      ...(test_secret_key !== undefined && { test_secret_key }),
      ...(test_publishable_key !== undefined && { test_publishable_key }),
      ...(live_secret_key !== undefined && { live_secret_key }),
      ...(live_publishable_key !== undefined && { live_publishable_key }),
    };

    const updateData: {
      config: Record<string, string | undefined>;
      updated_at: string;
      test_mode?: boolean;
      is_active?: boolean;
    } = {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    };

    if (test_mode !== undefined) {
      updateData.test_mode = test_mode;
    }

    // Automatically activate if keys are provided and is_active not explicitly set
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    } else if (test_secret_key || live_secret_key) {
      // If keys are being saved, activate the connection
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
        logger.error('Error updating Stripe connection:', error);
        return internalError('Failed to update Stripe connection', { error: error.message });
      }

      return NextResponse.json({ connection: data });
    } else {
      // Create new connection
      const { data, error } = await adminClient
        .from('system_connections')
        .insert({
          connection_type: 'stripe',
          config: updatedConfig,
          test_mode: test_mode ?? true,
          is_active: is_active !== undefined ? is_active : (test_secret_key || live_secret_key ? true : false),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating Stripe connection:', error);
        return internalError('Failed to create Stripe connection', { error: error.message });
      }

      return NextResponse.json({ connection: data });
    }
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/system/connections/stripe:', error);
    return internalError('Failed to update Stripe connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

