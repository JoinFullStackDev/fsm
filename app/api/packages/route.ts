import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// Types for package data
interface PackageRow {
  id: string;
  name: string;
  is_active: boolean;
  display_order: number | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  pricing_model: string | null;
  base_price_monthly: number | null;
  base_price_yearly: number | null;
  price_per_user_monthly: number | null;
  price_per_user_yearly: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: Record<string, boolean> | null;
}

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
    
    logger.info(`[Packages API] All packages in DB: ${JSON.stringify((allPackages as PackageRow[] | null)?.map((p) => ({ name: p.name, is_active: p.is_active })))}`);

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
    const typedPackages = packages as PackageRow[] | null;
    logger.info(`[Packages API] Found ${typedPackages?.length || 0} active packages`);
    if (typedPackages && typedPackages.length > 0) {
      logger.info(`[Packages API] Package names: ${typedPackages.map((p) => p.name).join(', ')}`);
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
    const publicPackages = (typedPackages || []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      stripe_price_id: pkg.stripe_price_id, // Backward compatibility
      stripe_product_id: pkg.stripe_product_id,
      pricing_model: pkg.pricing_model || 'per_user',
      base_price_monthly: pkg.base_price_monthly,
      base_price_yearly: pkg.base_price_yearly,
      price_per_user_monthly: pkg.price_per_user_monthly,
      price_per_user_yearly: pkg.price_per_user_yearly,
      stripe_price_id_monthly: pkg.stripe_price_id_monthly,
      stripe_price_id_yearly: pkg.stripe_price_id_yearly,
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

