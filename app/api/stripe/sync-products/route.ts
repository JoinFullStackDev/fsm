import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/sync-products
 * Fetch products from Stripe and return them for syncing with packages
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    if (!(await isStripeConfigured())) {
      return badRequest('Stripe is not configured');
    }

    const stripe = await getStripeClient();
    const products = await stripe.products.list({ active: true, limit: 100 });

    // Get prices for each product
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
        });

        // Find monthly recurring price
        const monthlyPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === 'month'
        );

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          active: product.active,
          monthly_price_id: monthlyPrice?.id || null,
          monthly_price_amount: monthlyPrice
            ? monthlyPrice.unit_amount! / 100
            : null,
          all_prices: prices.data.map((p) => ({
            id: p.id,
            amount: p.unit_amount ? p.unit_amount / 100 : null,
            interval: p.recurring?.interval || 'one_time',
          })),
        };
      })
    );

    return NextResponse.json({ products: productsWithPrices });
  } catch (error) {
    logger.error('Error in GET /api/stripe/sync-products:', error);
    return internalError('Failed to fetch Stripe products', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/stripe/sync-products
 * Link a Stripe product to a package and sync pricing
 * Only syncs: stripe_product_id, stripe_price_id, and price_per_user_monthly
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const body = await request.json();
    const { package_id, stripe_product_id, stripe_price_id, price_per_user_monthly } = body;

    if (!package_id || !stripe_product_id) {
      return badRequest('Missing required fields: package_id, stripe_product_id');
    }

    const adminClient = createAdminSupabaseClient();

    const updateData: any = {
      stripe_product_id,
      updated_at: new Date().toISOString(),
    };

    // If price ID is provided, also update that
    if (stripe_price_id) {
      updateData.stripe_price_id = stripe_price_id;
    }

    // If price amount is provided, update price_per_user_monthly
    if (price_per_user_monthly !== undefined && price_per_user_monthly !== null) {
      updateData.price_per_user_monthly = Number(price_per_user_monthly);
    }

    const { data: packageData, error: updateError } = await adminClient
      .from('packages')
      .update(updateData)
      .eq('id', package_id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating package:', updateError);
      return internalError('Failed to update package', { error: updateError.message });
    }

    return NextResponse.json({ package: packageData });
  } catch (error) {
    logger.error('Error in POST /api/stripe/sync-products:', error);
    return internalError('Failed to sync product', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

