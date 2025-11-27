import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/packages
 * Get all active packages (public endpoint for landing page)
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminSupabaseClient();

    // Fetch all packages first to debug
    const { data: allPackages } = await adminClient
      .from('packages')
      .select('id, name, is_active, display_order')
      .order('display_order', { ascending: true });
    
    logger.info(`[Packages API] All packages in DB: ${JSON.stringify(allPackages?.map((p: any) => ({ name: p.name, is_active: p.is_active })))}`);

    // Filter for active packages
    const { data: packages, error: packagesError } = await adminClient
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (packagesError) {
      logger.error('Error loading packages:', packagesError);
      return internalError('Failed to load packages', { error: packagesError.message });
    }

    // Log packages for debugging
    logger.info(`[Packages API] Found ${packages?.length || 0} active packages`);
    if (packages && packages.length > 0) {
      logger.info(`[Packages API] Package names: ${packages.map((p: any) => p.name).join(', ')}`);
      // Log first package details for debugging
      const firstPkg = packages[0];
      logger.info(`[Packages API] Sample package data: ${JSON.stringify({
        name: firstPkg.name,
        price: firstPkg.price_per_user_monthly,
        features: firstPkg.features,
        is_active: firstPkg.is_active,
      })}`);
    }

    // Return all package data needed for signup/display
    const publicPackages = (packages || []).map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      stripe_price_id: pkg.stripe_price_id,
      stripe_product_id: pkg.stripe_product_id,
      price_per_user_monthly: pkg.price_per_user_monthly,
      features: pkg.features,
      is_active: pkg.is_active,
      display_order: pkg.display_order,
    }));

    // Add cache control headers to prevent caching
    const response = NextResponse.json({ packages: publicPackages });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    logger.error('Error in GET /api/packages:', error);
    return internalError('Failed to load packages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

