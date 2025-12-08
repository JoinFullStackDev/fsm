import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import { validateVolumeDiscountRules } from '@/lib/stripe/enterprisePricing';
import logger from '@/lib/utils/logger';
import type { CreateEnterprisePackageInput } from '@/types/enterprise';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/enterprise-packages
 * Get all custom enterprise packages (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: packages, error: packagesError } = await adminClient
      .from('custom_enterprise_packages')
      .select(`
        *,
        organization:organizations(id, name, slug),
        package:packages(id, name)
      `)
      .order('created_at', { ascending: false });

    if (packagesError) {
      logger.error('Error loading enterprise packages:', packagesError);
      return internalError('Failed to load enterprise packages', { error: packagesError.message });
    }

    return NextResponse.json({ packages: packages || [] });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/enterprise-packages:', error);
    return internalError('Failed to load enterprise packages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/global/admin/enterprise-packages
 * Create a new custom enterprise package (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const userData = await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body: CreateEnterprisePackageInput = await request.json();

    const {
      organization_id,
      package_id,
      custom_name,
      custom_price_per_user_monthly,
      custom_price_per_user_yearly,
      custom_base_price_monthly,
      custom_base_price_yearly,
      volume_discount_rules = [],
      custom_max_users,
      custom_max_projects,
      custom_max_templates,
      custom_trial_days,
      contract_start_date,
      contract_end_date,
      minimum_commitment_users,
      minimum_commitment_months,
      custom_billing_interval,
      net_payment_terms = 30,
      notes,
    } = body;

    // Validate required fields
    if (!organization_id || !package_id) {
      return badRequest('Organization and base package are required');
    }

    // Validate organization exists
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      return badRequest('Organization not found');
    }

    // Validate package exists
    const { data: pkg, error: pkgError } = await adminClient
      .from('packages')
      .select('id, name')
      .eq('id', package_id)
      .single();

    if (pkgError || !pkg) {
      return badRequest('Package not found');
    }

    // Check if organization already has an enterprise package
    const { data: existing } = await adminClient
      .from('custom_enterprise_packages')
      .select('id')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (existing) {
      return badRequest('This organization already has a custom enterprise package');
    }

    // Validate volume discount rules
    if (volume_discount_rules.length > 0) {
      const validation = validateVolumeDiscountRules(volume_discount_rules);
      if (!validation.isValid) {
        return badRequest(validation.error || 'Invalid volume discount rules');
      }
    }

    // Create the enterprise package
    const { data: enterprisePackage, error: createError } = await adminClient
      .from('custom_enterprise_packages')
      .insert({
        organization_id,
        package_id,
        custom_name: custom_name || null,
        custom_price_per_user_monthly: custom_price_per_user_monthly ?? null,
        custom_price_per_user_yearly: custom_price_per_user_yearly ?? null,
        custom_base_price_monthly: custom_base_price_monthly ?? null,
        custom_base_price_yearly: custom_base_price_yearly ?? null,
        volume_discount_rules,
        custom_max_users: custom_max_users ?? null,
        custom_max_projects: custom_max_projects ?? null,
        custom_max_templates: custom_max_templates ?? null,
        custom_trial_days: custom_trial_days ?? null,
        contract_start_date: contract_start_date ?? null,
        contract_end_date: contract_end_date ?? null,
        minimum_commitment_users: minimum_commitment_users ?? null,
        minimum_commitment_months: minimum_commitment_months ?? null,
        custom_billing_interval: custom_billing_interval ?? null,
        net_payment_terms,
        notes: notes || null,
        is_active: true,
        created_by: userData.userId || null,
      })
      .select(`
        *,
        organization:organizations(id, name, slug),
        package:packages(id, name)
      `)
      .single();

    if (createError) {
      logger.error('Error creating enterprise package:', createError);
      if (createError.code === '23505') {
        return badRequest('This organization already has a custom enterprise package');
      }
      return internalError('Failed to create enterprise package', { error: createError.message });
    }

    logger.info('[EnterprisePackages] Created enterprise package:', {
      id: enterprisePackage.id,
      organizationId: organization_id,
      organizationName: org.name,
      packageName: pkg.name,
    });

    return NextResponse.json({ package: enterprisePackage });
  } catch (error) {
    logger.error('Error in POST /api/global/admin/enterprise-packages:', error);
    return internalError('Failed to create enterprise package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

