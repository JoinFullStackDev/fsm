import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { sendEmailWithRetry } from '@/lib/emailService';
import { getPrePaymentConfirmationTemplate } from '@/lib/emailTemplates';
import { isEmailConfigured } from '@/lib/emailService';

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
      billing_interval = 'month', // Customer's choice: 'month' or 'year'
      quantity = 1, // Number of users/seats for per-user plans
      email, 
      name, 
      organization_name,
      organization_id, // Organization ID if already created (during signup)
      success_url, 
      cancel_url 
    } = body;

    if (!package_id || !email || !organization_name || !success_url || !cancel_url) {
      return badRequest('Missing required fields: package_id, email, organization_name, success_url, cancel_url');
    }

    const supabase = createAdminSupabaseClient();

    // Get package with features
    const { data: packageData, error: pkgError } = await supabase
      .from('packages')
      .select('id, stripe_price_id, stripe_price_id_monthly, stripe_price_id_yearly, stripe_product_id, pricing_model, base_price_monthly, base_price_yearly, price_per_user_monthly, price_per_user_yearly, name, features')
      .eq('id', package_id)
      .single();

    if (pkgError || !packageData) {
      logger.error('[Stripe] Package not found:', pkgError);
      return badRequest('Invalid package selected');
    }

    // Check if package is free for selected interval
    const pricingModel = packageData.pricing_model || 'per_user';
    const selectedPrice = billing_interval === 'month'
      ? (pricingModel === 'per_user' ? packageData.price_per_user_monthly : packageData.base_price_monthly)
      : (pricingModel === 'per_user' ? packageData.price_per_user_yearly : packageData.base_price_yearly);
    const isFree = !selectedPrice || selectedPrice === 0;
    
    if (isFree) {
      return badRequest('Free packages do not require payment. Please use the standard signup flow.');
    }

    const stripe = await getStripeClient();
    let priceId: string | null = null;

    // Get the appropriate price ID based on billing interval
    const selectedPriceId = billing_interval === 'month'
      ? packageData.stripe_price_id_monthly
      : packageData.stripe_price_id_yearly;

    // Check if we have a valid price ID for the selected interval
    const isValidStripePriceId = selectedPriceId && 
      selectedPriceId.startsWith('price_');

    if (isValidStripePriceId) {
      // Verify the price exists in Stripe and amount matches
      try {
        const retrievedPrice = await stripe.prices.retrieve(selectedPriceId);
        
        // Calculate expected price amount
        const pricingModel = packageData.pricing_model || 'per_user';
        const expectedAmount = pricingModel === 'per_user'
          ? (billing_interval === 'month' ? (packageData.price_per_user_monthly || 0) : (packageData.price_per_user_yearly || 0))
          : (billing_interval === 'month' ? (packageData.base_price_monthly || 0) : (packageData.base_price_yearly || 0));
        const expectedAmountCents = Math.round(expectedAmount * 100);
        
        // Verify price amount matches package price
        if (retrievedPrice.unit_amount !== expectedAmountCents) {
          logger.warn('[Stripe] Price amount mismatch - Stripe price does not match package price:', {
            priceId: selectedPriceId,
            packageId: package_id,
            stripeAmount: retrievedPrice.unit_amount,
            expectedAmount: expectedAmountCents,
            interval: billing_interval,
          });
          // Don't use this price - will create new one below
          priceId = null;
        } else {
          priceId = selectedPriceId;
          logger.info('[Stripe] Price verified and matches package:', {
            priceId: selectedPriceId,
            amount: retrievedPrice.unit_amount,
            interval: billing_interval,
          });
        }
      } catch (priceError: any) {
        logger.warn('[Stripe] Price not found in Stripe, will try to use product:', {
          priceId: selectedPriceId,
          packageId: package_id,
          interval: billing_interval,
          error: priceError.message,
        });
        // Fall through to product ID logic
        priceId = null;
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

        // Find a price matching the billing interval
        const matchingPrice = prices.data.find(
          (p) => p.recurring && p.recurring.interval === billing_interval
        );

        if (matchingPrice) {
          // Verify the found price amount matches package price
          const pricingModel = packageData.pricing_model || 'per_user';
          const expectedAmount = pricingModel === 'per_user'
            ? (billing_interval === 'month' ? (packageData.price_per_user_monthly || 0) : (packageData.price_per_user_yearly || 0))
            : (billing_interval === 'month' ? (packageData.base_price_monthly || 0) : (packageData.base_price_yearly || 0));
          const expectedAmountCents = Math.round(expectedAmount * 100);
          
          if (matchingPrice.unit_amount !== expectedAmountCents) {
            logger.warn('[Stripe] Found price amount mismatch - will create new price:', {
              foundPriceId: matchingPrice.id,
              foundAmount: matchingPrice.unit_amount,
              expectedAmount: expectedAmountCents,
              interval: billing_interval,
            });
            // Don't use this price - will create new one below
            priceId = null;
          } else {
            priceId = matchingPrice.id;
            logger.info('[Stripe] Found price from product and verified amount:', {
              productId: packageData.stripe_product_id,
              priceId: priceId,
              amount: matchingPrice.unit_amount,
              interval: billing_interval,
            });
            
            // Update the package with the found price ID
            const updateField = billing_interval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
            await supabase
              .from('packages')
              .update({ [updateField]: priceId })
              .eq('id', package_id);
          }
        }
        
        // If no matching price or price amount doesn't match, create new one
        if (!priceId) {
          // Create a new price for this product
          const pricingModel = packageData.pricing_model || 'per_user';
          const unitAmount = pricingModel === 'per_user'
            ? (billing_interval === 'month' ? (packageData.price_per_user_monthly || 0) : (packageData.price_per_user_yearly || 0))
            : (billing_interval === 'month' ? (packageData.base_price_monthly || 0) : (packageData.base_price_yearly || 0));

          logger.info('[Stripe] Creating new price for product:', {
            productId: packageData.stripe_product_id,
            amount: Math.round(unitAmount * 100), // Convert to cents
            interval: billing_interval,
            pricingModel: pricingModel,
          });

          const newPrice = await stripe.prices.create({
            product: packageData.stripe_product_id,
            unit_amount: Math.round(unitAmount * 100), // Convert to cents
            currency: 'usd',
            recurring: {
              interval: billing_interval as 'month' | 'year',
              usage_type: 'licensed', // Explicitly set to licensed for proper quantity support
            },
          });

          priceId = newPrice.id;
          
          // Update the package with the new price ID for the correct interval
          const updateField = billing_interval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
          await supabase
            .from('packages')
            .update({ [updateField]: priceId })
            .eq('id', package_id);

          logger.info('[Stripe] Created and saved new price:', { priceId, interval: billing_interval });
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

    // Final price verification before creating checkout session
    // Verify price amount one more time to ensure it matches
    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
      
      // Verify price amount matches package price
      const pricingModel = packageData.pricing_model || 'per_user';
      const expectedAmount = pricingModel === 'per_user'
        ? (billing_interval === 'month' ? (packageData.price_per_user_monthly || 0) : (packageData.price_per_user_yearly || 0))
        : (billing_interval === 'month' ? (packageData.base_price_monthly || 0) : (packageData.base_price_yearly || 0));
      const expectedAmountCents = Math.round(expectedAmount * 100);
      
      if (price.unit_amount !== expectedAmountCents) {
        logger.error('[Stripe] CRITICAL: Price amount mismatch at checkout creation:', {
          priceId,
          packageId: package_id,
          stripeAmount: price.unit_amount,
          expectedAmount: expectedAmountCents,
          interval: billing_interval,
        });
        return badRequest(
          `Price configuration error: The selected package price does not match the configured amount. ` +
          `Please contact support.`
        );
      }
      
      logger.info('[Stripe] Price verified before checkout creation:', {
        priceId,
        amount: price.unit_amount,
        expectedAmount: expectedAmountCents,
        interval: billing_interval,
      });
    } catch (priceError: any) {
      logger.error('[Stripe] Error retrieving price:', {
        priceId,
        error: priceError.message,
      });
      return badRequest('Failed to retrieve price information');
    }

    const isMetered = price.recurring?.usage_type === 'metered';
    const pricingModelForMetered = packageData.pricing_model || 'per_user';
    
    // If metered and per-user pricing, create a licensed price instead
    if (isMetered && pricingModelForMetered === 'per_user') {
      logger.info('[Stripe] Metered price detected for per-user pricing, creating licensed replacement:', {
        priceId,
        packageId: package_id,
        interval: billing_interval,
      });

      const unitAmount = billing_interval === 'month'
        ? (packageData.price_per_user_monthly || 0)
        : (packageData.price_per_user_yearly || 0);

      const newPrice = await stripe.prices.create({
        product: packageData.stripe_product_id,
        unit_amount: Math.round(unitAmount * 100),
        currency: 'usd',
        recurring: {
          interval: billing_interval as 'month' | 'year',
          usage_type: 'licensed',
        },
      });

      priceId = newPrice.id;
      const updateField = billing_interval === 'month' ? 'stripe_price_id_monthly' : 'stripe_price_id_yearly';
      await supabase
        .from('packages')
        .update({ [updateField]: priceId })
        .eq('id', package_id);

      logger.info('[Stripe] Created licensed price replacement:', {
        oldPriceId: price.id,
        newPriceId: priceId,
      });
    }

    // Build line_items conditionally based on usage_type
    const lineItems: any[] = [{
      price: priceId,
    }];

    // Only add quantity for licensed prices with per-user pricing
    // Metered prices don't support quantity at all
    if (!isMetered && pricingModel === 'per_user') {
      lineItems[0].quantity = quantity || 1;
    }
    // For metered or flat-rate licensed, omit quantity (defaults to 1)

    // Create checkout session with signup metadata
    // We'll create the organization and user after payment succeeds
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'subscription',
        success_url: success_url,
        cancel_url: cancel_url,
        metadata: {
          // Store signup data in metadata
          signup_email: email,
          signup_name: name || '',
          organization_name: organization_name,
          organization_id: organization_id || '', // Include organization_id if available
          package_id: package_id,
          quantity: String(quantity || 1),
          is_signup: 'true',
        },
        subscription_data: {
          metadata: {
            organization_id: organization_id || '', // Include organization_id in subscription metadata
            package_id: package_id,
            billing_interval: billing_interval,
            quantity: String(quantity || 1),
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

    // Send pre-payment confirmation email
    try {
      const emailConfigured = await isEmailConfigured();
      if (emailConfigured && packageData.features) {
        const pricingModel = packageData.pricing_model || 'per_user';
        const monthlyPrice = pricingModel === 'per_user' 
          ? packageData.price_per_user_monthly 
          : packageData.base_price_monthly;
        const yearlyPrice = pricingModel === 'per_user' 
          ? packageData.price_per_user_yearly 
          : packageData.base_price_yearly;
        
        const template = await getPrePaymentConfirmationTemplate(
          name || email.split('@')[0],
          packageData.name,
          {
            pricingModel,
            monthlyPrice,
            yearlyPrice,
            billingInterval: billing_interval as 'month' | 'year',
            quantity: quantity || 1,
            features: {
              maxProjects: packageData.features.max_projects,
              maxUsers: packageData.features.max_users,
              maxTemplates: packageData.features.max_templates,
              aiFeatures: packageData.features.ai_features_enabled || false,
              exportFeatures: packageData.features.export_features_enabled || false,
              opsTool: packageData.features.ops_tool_enabled || false,
              analytics: packageData.features.analytics_enabled || false,
              apiAccess: packageData.features.api_access_enabled || false,
              customDashboards: packageData.features.custom_dashboards_enabled || false,
              supportLevel: packageData.features.support_level || 'community',
            },
          }
        );
        
        // Pre-signup, no organization context yet
        const emailResult = await sendEmailWithRetry(email, template.subject, template.html, template.text, undefined, undefined, null);
        if (emailResult.success) {
          logger.info('[Stripe] Pre-payment confirmation email sent successfully', { 
            email, 
            packageId: package_id,
            subject: template.subject,
          });
        } else {
          logger.error('[Stripe] Failed to send pre-payment confirmation email:', {
            email,
            packageId: package_id,
            error: emailResult.error,
            subject: template.subject,
          });
        }
      } else {
        logger.warn('[Stripe] Email not configured, skipping pre-payment confirmation email', { email, packageId: package_id });
      }
    } catch (emailError) {
      // Don't fail the checkout if email fails, but log the error
      logger.error('[Stripe] Error in pre-payment email flow:', {
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
        email,
        packageId: package_id,
        stack: emailError instanceof Error ? emailError.stack : undefined,
      });
    }

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

