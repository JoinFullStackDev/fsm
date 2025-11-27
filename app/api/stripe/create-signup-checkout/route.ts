import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/create-signup-checkout
 * Create a Stripe checkout session for signup (no auth required)
 * This is used during the signup flow before account creation
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isStripeConfigured())) {
      logger.warn('[Stripe] Stripe is not configured');
      return badRequest('Payment processing is not available');
    }

    const body = await request.json();
    const { 
      package_id, 
      email, 
      name, 
      organization_name,
      success_url, 
      cancel_url 
    } = body;

    if (!package_id || !email || !organization_name || !success_url || !cancel_url) {
      return badRequest('Missing required fields: package_id, email, organization_name, success_url, cancel_url');
    }

    const supabase = createAdminSupabaseClient();

    // Get package
    const { data: packageData, error: pkgError } = await supabase
      .from('packages')
      .select('id, stripe_price_id, stripe_product_id, price_per_user_monthly, name')
      .eq('id', package_id)
      .single();

    if (pkgError || !packageData) {
      logger.error('[Stripe] Package not found:', pkgError);
      return badRequest('Invalid package selected');
    }

    // If package is free, don't require payment
    if (packageData.price_per_user_monthly === 0) {
      return badRequest('Free packages do not require payment. Please use the standard signup flow.');
    }

    const stripe = await getStripeClient();
    let priceId: string | null = null;

    // Check if we have a valid price ID
    const isValidStripePriceId = packageData.stripe_price_id && 
      packageData.stripe_price_id.startsWith('price_');

    if (isValidStripePriceId) {
      // Verify the price exists in Stripe
      try {
        await stripe.prices.retrieve(packageData.stripe_price_id);
        priceId = packageData.stripe_price_id;
      } catch (priceError: any) {
        logger.warn('[Stripe] Price not found in Stripe, will try to use product:', {
          priceId: packageData.stripe_price_id,
          packageId: package_id,
          error: priceError.message,
        });
        // Fall through to product ID logic
      }
    }

    // If no valid price ID, try to get/create price from product ID
    if (!priceId && packageData.stripe_product_id) {
      try {
        // Fetch the product
        const product = await stripe.products.retrieve(packageData.stripe_product_id);
        
        // Get all prices for this product
        const prices = await stripe.prices.list({
          product: packageData.stripe_product_id,
          active: true,
        });

        // Find a recurring monthly price
        const monthlyPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === 'month'
        );

        if (monthlyPrice) {
          priceId = monthlyPrice.id;
          logger.info('[Stripe] Found price from product:', {
            productId: packageData.stripe_product_id,
            priceId: priceId,
          });
        } else {
          // Create a new price for this product
          logger.info('[Stripe] Creating new price for product:', {
            productId: packageData.stripe_product_id,
            amount: Math.round(packageData.price_per_user_monthly * 100), // Convert to cents
          });

          const newPrice = await stripe.prices.create({
            product: packageData.stripe_product_id,
            unit_amount: Math.round(packageData.price_per_user_monthly * 100), // Convert to cents
            currency: 'usd',
            recurring: {
              interval: 'month',
            },
          });

          priceId = newPrice.id;
          
          // Update the package with the new price ID
          await supabase
            .from('packages')
            .update({ stripe_price_id: priceId })
            .eq('id', package_id);

          logger.info('[Stripe] Created and saved new price:', { priceId });
        }
      } catch (productError: any) {
        logger.error('[Stripe] Error with product:', {
          productId: packageData.stripe_product_id,
          error: productError.message,
        });
        
        return badRequest(
          `The selected package "${packageData.name}" is not properly configured for payment. ` +
          `Please contact support or select a different package.`
        );
      }
    }

    // If we still don't have a price ID, return error
    if (!priceId) {
      logger.error('[Stripe] No valid price ID or product ID found:', {
        packageId: package_id,
        packageName: packageData.name,
        stripe_price_id: packageData.stripe_price_id,
        stripe_product_id: packageData.stripe_product_id,
      });
      
      return badRequest(
        `The selected package "${packageData.name}" is not properly configured for payment. ` +
        `Please contact support or select a different package.`
      );
    }

    // Create checkout session with signup metadata
    // We'll create the organization and user after payment succeeds
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: success_url,
        cancel_url: cancel_url,
        metadata: {
          // Store signup data in metadata
          signup_email: email,
          signup_name: name || '',
          organization_name: organization_name,
          package_id: package_id,
          is_signup: 'true',
        },
        subscription_data: {
          metadata: {
            package_id: package_id,
            is_signup: 'true',
          },
        },
      });
    } catch (stripeError: any) {
      logger.error('[Stripe] Error creating checkout session:', {
        error: stripeError.message,
        code: stripeError.code,
        priceId: priceId,
        packageId: package_id,
      });
      
      // Provide user-friendly error messages
      if (stripeError.code === 'resource_missing' || stripeError.message?.includes('No such price')) {
        return badRequest(
          `The selected package "${packageData.name}" is not properly configured for payment. ` +
          `Please contact support or select a different package.`
        );
      }
      
      throw stripeError; // Re-throw other errors to be caught by outer catch
    }

    logger.debug('[Stripe] Created signup checkout session:', { 
      sessionId: session.id, 
      email,
      packageId: package_id 
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Error in POST /api/stripe/create-signup-checkout:', error);
    
    // If it's already a badRequest response, return it
    if (error instanceof Response) {
      return error;
    }
    
    return internalError('Failed to create checkout session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

