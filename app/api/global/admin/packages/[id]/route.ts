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
      price_per_user_monthly,
      features,
      is_active,
      display_order,
    } = body;

    // Check if package exists
    const { data: existing, error: fetchError } = await adminClient
      .from('packages')
      .select('id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Package not found');
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (stripe_price_id !== undefined) updateData.stripe_price_id = stripe_price_id || null;
    if (stripe_product_id !== undefined) updateData.stripe_product_id = stripe_product_id || null;
    if (price_per_user_monthly !== undefined) updateData.price_per_user_monthly = Number(price_per_user_monthly);
    if (features !== undefined) updateData.features = features;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = Number(display_order);

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

