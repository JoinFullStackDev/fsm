import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import { validateVolumeDiscountRules } from '@/lib/stripe/enterprisePricing';
import logger from '@/lib/utils/logger';
import type { UpdateEnterprisePackageInput } from '@/types/enterprise';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/enterprise-packages/[id]
 * Get a specific enterprise package (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: pkg, error: pkgError } = await adminClient
      .from('custom_enterprise_packages')
      .select(`
        *,
        organization:organizations(id, name, slug),
        package:packages(id, name, price_per_user_monthly, price_per_user_yearly)
      `)
      .eq('id', params.id)
      .single();

    if (pkgError || !pkg) {
      return notFound('Enterprise package not found');
    }

    return NextResponse.json({ package: pkg });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/enterprise-packages/[id]:', error);
    return internalError('Failed to load enterprise package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/global/admin/enterprise-packages/[id]
 * Update an enterprise package (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body: UpdateEnterprisePackageInput = await request.json();

    // Check if enterprise package exists
    const { data: existing, error: fetchError } = await adminClient
      .from('custom_enterprise_packages')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Enterprise package not found');
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.package_id !== undefined) {
      // Validate package exists
      const { data: pkg } = await adminClient
        .from('packages')
        .select('id')
        .eq('id', body.package_id)
        .single();
      if (!pkg) {
        return badRequest('Package not found');
      }
      updateData.package_id = body.package_id;
    }

    if (body.custom_name !== undefined) updateData.custom_name = body.custom_name || null;
    if (body.custom_price_per_user_monthly !== undefined) {
      updateData.custom_price_per_user_monthly = body.custom_price_per_user_monthly;
    }
    if (body.custom_price_per_user_yearly !== undefined) {
      updateData.custom_price_per_user_yearly = body.custom_price_per_user_yearly;
    }
    if (body.custom_base_price_monthly !== undefined) {
      updateData.custom_base_price_monthly = body.custom_base_price_monthly;
    }
    if (body.custom_base_price_yearly !== undefined) {
      updateData.custom_base_price_yearly = body.custom_base_price_yearly;
    }
    
    if (body.volume_discount_rules !== undefined) {
      // Validate volume discount rules
      if (body.volume_discount_rules.length > 0) {
        const validation = validateVolumeDiscountRules(body.volume_discount_rules);
        if (!validation.isValid) {
          return badRequest(validation.error || 'Invalid volume discount rules');
        }
      }
      updateData.volume_discount_rules = body.volume_discount_rules;
    }

    if (body.custom_max_users !== undefined) updateData.custom_max_users = body.custom_max_users;
    if (body.custom_max_projects !== undefined) updateData.custom_max_projects = body.custom_max_projects;
    if (body.custom_max_templates !== undefined) updateData.custom_max_templates = body.custom_max_templates;
    if (body.custom_trial_days !== undefined) updateData.custom_trial_days = body.custom_trial_days;
    if (body.contract_start_date !== undefined) updateData.contract_start_date = body.contract_start_date;
    if (body.contract_end_date !== undefined) updateData.contract_end_date = body.contract_end_date;
    if (body.minimum_commitment_users !== undefined) {
      updateData.minimum_commitment_users = body.minimum_commitment_users;
    }
    if (body.minimum_commitment_months !== undefined) {
      updateData.minimum_commitment_months = body.minimum_commitment_months;
    }
    if (body.custom_billing_interval !== undefined) {
      updateData.custom_billing_interval = body.custom_billing_interval;
    }
    if (body.net_payment_terms !== undefined) updateData.net_payment_terms = body.net_payment_terms;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data: enterprisePackage, error: updateError } = await adminClient
      .from('custom_enterprise_packages')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        organization:organizations(id, name, slug),
        package:packages(id, name)
      `)
      .single();

    if (updateError) {
      logger.error('Error updating enterprise package:', updateError);
      return internalError('Failed to update enterprise package', { error: updateError.message });
    }

    logger.info('[EnterprisePackages] Updated enterprise package:', {
      id: enterprisePackage.id,
      organizationId: existing.organization_id,
    });

    return NextResponse.json({ package: enterprisePackage });
  } catch (error) {
    logger.error('Error in PUT /api/global/admin/enterprise-packages/[id]:', error);
    return internalError('Failed to update enterprise package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/global/admin/enterprise-packages/[id]
 * Delete an enterprise package (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Check if enterprise package exists
    const { data: existing, error: fetchError } = await adminClient
      .from('custom_enterprise_packages')
      .select('id, organization_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return notFound('Enterprise package not found');
    }

    // Delete the enterprise package
    const { error: deleteError } = await adminClient
      .from('custom_enterprise_packages')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('Error deleting enterprise package:', deleteError);
      return internalError('Failed to delete enterprise package', { error: deleteError.message });
    }

    logger.info('[EnterprisePackages] Deleted enterprise package:', {
      id: existing.id,
      organizationId: existing.organization_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/global/admin/enterprise-packages/[id]:', error);
    return internalError('Failed to delete enterprise package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

