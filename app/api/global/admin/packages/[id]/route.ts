import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError, badRequest, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/global/admin/packages/[id]
 * Update a package (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();

    const {
      name,
      stripe_price_id,
      stripe_product_id,
      pricing_model,
      base_price_monthly,
      base_price_yearly,
      price_per_user_monthly,
      price_per_user_yearly,
      stripe_price_id_monthly,
      stripe_price_id_yearly,
      features,
      is_active,
      display_order,
      trial_enabled,
      trial_days,
    } = body;

    // Check if package exists
    const { data: existing, error: fetchError } = await adminClient
      .from('packages')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Package not found');
    }

    // Get current values for validation
    const currentModel = pricing_model !== undefined ? pricing_model : existing.pricing_model || 'per_user';

    // Validate pricing model
    if (pricing_model !== undefined && pricing_model !== 'per_user' && pricing_model !== 'flat_rate') {
      return badRequest('pricing_model must be either "per_user" or "flat_rate"');
    }

    // Validate pricing fields based on model - require at least one price if model is being set
    const model = currentModel;
    if (pricing_model !== undefined) {
      if (model === 'per_user') {
        const hasMonthly = price_per_user_monthly !== undefined ? price_per_user_monthly !== null : (existing.price_per_user_monthly !== null);
        const hasYearly = price_per_user_yearly !== undefined ? price_per_user_yearly !== null : (existing.price_per_user_yearly !== null);
        if (!hasMonthly && !hasYearly) {
          return badRequest('At least one of price_per_user_monthly or price_per_user_yearly is required for per_user pricing model');
        }
      } else if (model === 'flat_rate') {
        const hasMonthly = base_price_monthly !== undefined ? base_price_monthly !== null : (existing.base_price_monthly !== null);
        const hasYearly = base_price_yearly !== undefined ? base_price_yearly !== null : (existing.base_price_yearly !== null);
        if (!hasMonthly && !hasYearly) {
          return badRequest('At least one of base_price_monthly or base_price_yearly is required for flat_rate pricing model');
        }
      }
    }

    // Build update object
    interface PackageUpdateData {
      updated_at: string;
      name?: string;
      stripe_price_id?: string | null;
      stripe_product_id?: string | null;
      pricing_model?: string;
      base_price_monthly?: number | null;
      base_price_yearly?: number | null;
      price_per_user_monthly?: number | null;
      price_per_user_yearly?: number | null;
      stripe_price_id_monthly?: string | null;
      stripe_price_id_yearly?: string | null;
      features?: string[];
      is_active?: boolean;
      display_order?: number;
      trial_enabled?: boolean;
      trial_days?: number;
    }
    const updateData: PackageUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (stripe_price_id !== undefined) updateData.stripe_price_id = stripe_price_id || null;
    if (stripe_product_id !== undefined) updateData.stripe_product_id = stripe_product_id || null;
    if (pricing_model !== undefined) updateData.pricing_model = pricing_model;
    
    // Update monthly/yearly pricing fields
    if (base_price_monthly !== undefined) {
      updateData.base_price_monthly = model === 'flat_rate' ? (base_price_monthly !== null ? Number(base_price_monthly) : null) : null;
    }
    if (base_price_yearly !== undefined) {
      updateData.base_price_yearly = model === 'flat_rate' ? (base_price_yearly !== null ? Number(base_price_yearly) : null) : null;
    }
    if (price_per_user_monthly !== undefined) {
      updateData.price_per_user_monthly = model === 'per_user' ? (price_per_user_monthly !== null ? Number(price_per_user_monthly) : null) : null;
    }
    if (price_per_user_yearly !== undefined) {
      updateData.price_per_user_yearly = model === 'per_user' ? (price_per_user_yearly !== null ? Number(price_per_user_yearly) : null) : null;
    }
    if (stripe_price_id_monthly !== undefined) updateData.stripe_price_id_monthly = stripe_price_id_monthly || null;
    if (stripe_price_id_yearly !== undefined) updateData.stripe_price_id_yearly = stripe_price_id_yearly || null;
    
    if (features !== undefined) updateData.features = features;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = Number(display_order);
    if (trial_enabled !== undefined) updateData.trial_enabled = trial_enabled === true;
    if (trial_days !== undefined) updateData.trial_days = trial_days ? Number(trial_days) : 0;

    const { data: packageData, error: updateError } = await adminClient
      .from('packages')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating package:', updateError);
      return internalError('Failed to update package', { error: updateError.message });
    }

    return NextResponse.json({ package: packageData });
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/packages/[id]:', error);
    return internalError('Failed to update package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/global/admin/packages/[id]
 * Delete a package (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Check if package exists
    const { data: existing, error: fetchError } = await adminClient
      .from('packages')
      .select('id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Package not found');
    }

    // Check if package is in use
    const { data: subscriptions, error: subError } = await adminClient
      .from('subscriptions')
      .select('id')
      .eq('package_id', params.id)
      .limit(1);

    if (subError) {
      logger.error('Error checking package usage:', subError);
      return internalError('Failed to check package usage', { error: subError.message });
    }

    if (subscriptions && subscriptions.length > 0) {
      return badRequest('Cannot delete package that is in use by active subscriptions');
    }

    // Delete package
    const { error: deleteError } = await adminClient
      .from('packages')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('Error deleting package:', deleteError);
      return internalError('Failed to delete package', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/global/admin/packages/[id]:', error);
    return internalError('Failed to delete package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

