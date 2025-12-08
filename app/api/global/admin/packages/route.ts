import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/packages
 * Get all packages (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    const { data: packages, error: packagesError } = await adminClient
      .from('packages')
      .select('*')
      .order('display_order', { ascending: true });

    if (packagesError) {
      logger.error('Error loading packages:', packagesError);
      return internalError('Failed to load packages', { error: packagesError.message });
    }

    return NextResponse.json({ packages: packages || [] });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/packages:', error);
    return internalError('Failed to load packages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/global/admin/packages
 * Create a new package (super admin only)
 */
export async function POST(request: NextRequest) {
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

    // Validate required fields
    if (!name) {
      return badRequest('Name is required');
    }

    // Validate pricing model
    const model = pricing_model || 'per_user';
    if (model !== 'per_user' && model !== 'flat_rate') {
      return badRequest('pricing_model must be either "per_user" or "flat_rate"');
    }

    // Validate pricing fields based on model - require at least one price
    if (model === 'per_user') {
      if (!price_per_user_monthly && !price_per_user_yearly) {
        return badRequest('At least one of price_per_user_monthly or price_per_user_yearly is required for per_user pricing model');
      }
    } else if (model === 'flat_rate') {
      if (!base_price_monthly && !base_price_yearly) {
        return badRequest('At least one of base_price_monthly or base_price_yearly is required for flat_rate pricing model');
      }
    }

    // Validate features structure
    if (!features || typeof features !== 'object') {
      return badRequest('Features object is required');
    }

    // Get max display_order if not provided
    let order = display_order;
    if (order === undefined) {
      const { data: existing } = await adminClient
        .from('packages')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      order = existing ? (existing.display_order || 0) + 1 : 0;
    }

    const { data: packageData, error: createError } = await adminClient
      .from('packages')
      .insert({
        name,
        stripe_price_id: stripe_price_id || stripe_price_id_monthly || null, // Backward compatibility
        stripe_product_id: stripe_product_id || null,
        pricing_model: model,
        base_price_monthly: model === 'flat_rate' ? (base_price_monthly !== undefined ? Number(base_price_monthly) : null) : null,
        base_price_yearly: model === 'flat_rate' ? (base_price_yearly !== undefined ? Number(base_price_yearly) : null) : null,
        price_per_user_monthly: model === 'per_user' ? (price_per_user_monthly !== undefined ? Number(price_per_user_monthly) : null) : null,
        price_per_user_yearly: model === 'per_user' ? (price_per_user_yearly !== undefined ? Number(price_per_user_yearly) : null) : null,
        stripe_price_id_monthly: stripe_price_id_monthly || null,
        stripe_price_id_yearly: stripe_price_id_yearly || null,
        features: features || {},
        is_active: is_active !== undefined ? is_active : true,
        display_order: order,
        trial_enabled: trial_enabled === true,
        trial_days: trial_enabled && trial_days ? Number(trial_days) : 0,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating package:', createError);
      return internalError('Failed to create package', { error: createError.message });
    }

    return NextResponse.json({ package: packageData });
  } catch (error) {
    logger.error('Error in POST /api/global/admin/packages:', error);
    return internalError('Failed to create package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

