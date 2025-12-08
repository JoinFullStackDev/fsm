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

        // Find monthly and yearly recurring prices
        const monthlyPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === 'month'
        );
        const yearlyPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === 'year'
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
          yearly_price_id: yearlyPrice?.id || null,
          yearly_price_amount: yearlyPrice
            ? yearlyPrice.unit_amount! / 100
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
 * Syncs: stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly, pricing_model, base_price_monthly, base_price_yearly, price_per_user_monthly, price_per_user_yearly
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const body = await request.json();
    const { 
      package_id, 
      stripe_product_id, 
      stripe_price_id_monthly,
      stripe_price_id_yearly,
      pricing_model,
      base_price_monthly,
      base_price_yearly,
      price_per_user_monthly,
      price_per_user_yearly,
    } = body;

    if (!package_id || !stripe_product_id) {
      return badRequest('Missing required fields: package_id, stripe_product_id');
    }

    const adminClient = createAdminSupabaseClient();

    // Get the package to determine current pricing model if not provided
    const { data: existingPackage } = await adminClient
      .from('packages')
      .select('*')
      .eq('id', package_id)
      .single();

    if (!existingPackage) {
      return badRequest('Package not found');
    }

    // If price IDs are provided, fetch them from Stripe to determine billing intervals
    let detectedModel: 'per_user' | 'flat_rate' = pricing_model || existingPackage.pricing_model || 'per_user';
    
    // Detect intervals from Stripe prices if provided
    if ((stripe_price_id_monthly || stripe_price_id_yearly) && (await isStripeConfigured())) {
      try {
        const stripe = await getStripeClient();
        if (stripe_price_id_monthly) {
          const price = await stripe.prices.retrieve(stripe_price_id_monthly);
          if (price.recurring && price.recurring.interval !== 'month') {
            logger.warn('Monthly price ID has non-monthly interval:', price.recurring.interval);
          }
        }
        if (stripe_price_id_yearly) {
          const price = await stripe.prices.retrieve(stripe_price_id_yearly);
          if (price.recurring && price.recurring.interval !== 'year') {
            logger.warn('Yearly price ID has non-yearly interval:', price.recurring.interval);
          }
        }
      } catch (error) {
        logger.warn('Could not fetch price from Stripe:', error);
      }
    }

    interface PackageSyncData {
      stripe_product_id: string;
      updated_at: string;
      pricing_model?: string;
      stripe_price_id_monthly?: string | null;
      stripe_price_id_yearly?: string | null;
      price_per_user_monthly?: number | null;
      price_per_user_yearly?: number | null;
      base_price_monthly?: number | null;
      base_price_yearly?: number | null;
    }
    const updateData: PackageSyncData = {
      stripe_product_id,
      updated_at: new Date().toISOString(),
    };

    // Update pricing model if provided
    if (pricing_model) {
      updateData.pricing_model = pricing_model;
    } else {
      updateData.pricing_model = detectedModel;
    }

    const finalModel = pricing_model || detectedModel;

    // Update price IDs
    if (stripe_price_id_monthly !== undefined) {
      updateData.stripe_price_id_monthly = stripe_price_id_monthly || null;
    }
    if (stripe_price_id_yearly !== undefined) {
      updateData.stripe_price_id_yearly = stripe_price_id_yearly || null;
    }

    // Update pricing fields based on model
    if (finalModel === 'per_user') {
      if (price_per_user_monthly !== undefined) {
        updateData.price_per_user_monthly = price_per_user_monthly !== null ? Number(price_per_user_monthly) : null;
      }
      if (price_per_user_yearly !== undefined) {
        updateData.price_per_user_yearly = price_per_user_yearly !== null ? Number(price_per_user_yearly) : null;
      }
    } else {
      if (base_price_monthly !== undefined) {
        updateData.base_price_monthly = base_price_monthly !== null ? Number(base_price_monthly) : null;
      }
      if (base_price_yearly !== undefined) {
        updateData.base_price_yearly = base_price_yearly !== null ? Number(base_price_yearly) : null;
      }
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

