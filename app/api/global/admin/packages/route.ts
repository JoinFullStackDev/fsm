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
      price_per_user_monthly,
      features,
      is_active,
      display_order,
    } = body;

    // Validate required fields
    if (!name || price_per_user_monthly === undefined) {
      return badRequest('Name and price_per_user_monthly are required');
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
        stripe_price_id: stripe_price_id || null,
        stripe_product_id: stripe_product_id || null,
        price_per_user_monthly: Number(price_per_user_monthly),
        features: features || {},
        is_active: is_active !== undefined ? is_active : true,
        display_order: order,
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

