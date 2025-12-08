import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { UpdateAffiliateCodeInput } from '@/types/affiliate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/affiliates/[id]
 * Get a specific affiliate code with conversions (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get affiliate code
    const { data: affiliate, error: affiliateError } = await adminClient
      .from('affiliate_codes')
      .select('*')
      .eq('id', params.id)
      .single();

    if (affiliateError || !affiliate) {
      return notFound('Affiliate code not found');
    }

    // Get conversions for this affiliate
    const { data: conversions, error: conversionsError } = await adminClient
      .from('affiliate_conversions')
      .select(`
        *,
        organization:organizations(id, name, slug)
      `)
      .eq('affiliate_code_id', params.id)
      .order('converted_at', { ascending: false });

    if (conversionsError) {
      logger.error('Error loading conversions:', conversionsError);
    }

    return NextResponse.json({
      affiliate,
      conversions: conversions || [],
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/affiliates/[id]:', error);
    return internalError('Failed to load affiliate', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/global/admin/affiliates/[id]
 * Update an affiliate code (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body: UpdateAffiliateCodeInput = await request.json();

    // Check if affiliate exists
    const { data: existing, error: fetchError } = await adminClient
      .from('affiliate_codes')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Affiliate code not found');
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.code !== undefined) {
      // Validate code format
      if (!/^[A-Za-z0-9_-]+$/.test(body.code)) {
        return badRequest('Code must contain only letters, numbers, underscores, and dashes');
      }
      // Check if new code already exists (if different)
      if (body.code.toUpperCase() !== existing.code) {
        const { data: codeExists } = await adminClient
          .from('affiliate_codes')
          .select('id')
          .eq('code', body.code.toUpperCase())
          .neq('id', params.id)
          .maybeSingle();

        if (codeExists) {
          return badRequest('An affiliate code with this code already exists');
        }
      }
      updateData.code = body.code.toUpperCase();
    }

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.discount_type !== undefined) {
      if (!['percentage', 'fixed_amount', 'trial_extension'].includes(body.discount_type)) {
        return badRequest('Invalid discount type');
      }
      updateData.discount_type = body.discount_type;
    }
    if (body.discount_value !== undefined) {
      const discountType = body.discount_type || existing.discount_type;
      if (discountType === 'percentage' && (body.discount_value < 0 || body.discount_value > 100)) {
        return badRequest('Percentage discount must be between 0 and 100');
      }
      if (discountType === 'fixed_amount' && body.discount_value < 0) {
        return badRequest('Fixed amount discount must be positive');
      }
      updateData.discount_value = body.discount_value;
    }
    if (body.discount_duration_months !== undefined) {
      updateData.discount_duration_months = body.discount_duration_months;
    }
    if (body.bonus_trial_days !== undefined) {
      updateData.bonus_trial_days = body.bonus_trial_days;
    }
    if (body.affiliate_email !== undefined) {
      updateData.affiliate_email = body.affiliate_email || null;
    }
    if (body.commission_percentage !== undefined) {
      if (body.commission_percentage < 0 || body.commission_percentage > 100) {
        return badRequest('Commission percentage must be between 0 and 100');
      }
      updateData.commission_percentage = body.commission_percentage;
    }
    if (body.max_uses !== undefined) {
      updateData.max_uses = body.max_uses;
    }
    if (body.valid_from !== undefined) {
      updateData.valid_from = body.valid_from;
    }
    if (body.valid_until !== undefined) {
      updateData.valid_until = body.valid_until;
    }
    if (body.applicable_package_ids !== undefined) {
      updateData.applicable_package_ids = body.applicable_package_ids;
    }
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    const { data: affiliate, error: updateError } = await adminClient
      .from('affiliate_codes')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating affiliate:', updateError);
      return internalError('Failed to update affiliate', { error: updateError.message });
    }

    logger.info('[Affiliates] Updated affiliate code:', {
      id: affiliate.id,
      code: affiliate.code,
    });

    return NextResponse.json({ affiliate });
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/affiliates/[id]:', error);
    return internalError('Failed to update affiliate', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/global/admin/affiliates/[id]
 * Delete an affiliate code (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Check if affiliate exists
    const { data: existing, error: fetchError } = await adminClient
      .from('affiliate_codes')
      .select('id, code, current_uses')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Affiliate code not found');
    }

    // Check if affiliate has been used
    if (existing.current_uses > 0) {
      // Instead of deleting, just deactivate
      const { error: updateError } = await adminClient
        .from('affiliate_codes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', params.id);

      if (updateError) {
        logger.error('Error deactivating affiliate:', updateError);
        return internalError('Failed to deactivate affiliate', { error: updateError.message });
      }

      logger.info('[Affiliates] Deactivated affiliate code (has conversions):', {
        id: existing.id,
        code: existing.code,
        uses: existing.current_uses,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Affiliate code has been deactivated (not deleted) because it has been used',
        deactivated: true,
      });
    }

    // Delete the affiliate code
    const { error: deleteError } = await adminClient
      .from('affiliate_codes')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('Error deleting affiliate:', deleteError);
      return internalError('Failed to delete affiliate', { error: deleteError.message });
    }

    logger.info('[Affiliates] Deleted affiliate code:', {
      id: existing.id,
      code: existing.code,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/global/admin/affiliates/[id]:', error);
    return internalError('Failed to delete affiliate', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

