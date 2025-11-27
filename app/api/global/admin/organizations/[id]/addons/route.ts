import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/organizations/[id]/addons
 * Get current add-ons (additional packages) for organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get all subscriptions for this organization (main + add-ons)
    const { data: subscriptions, error: subError } = await adminClient
      .from('subscriptions')
      .select(`
        *,
        packages (
          id,
          name,
          price_per_user_monthly,
          features
        )
      `)
      .eq('organization_id', params.id)
      .order('created_at', { ascending: true });

    if (subError) {
      logger.error('Error fetching subscriptions:', subError);
      return internalError('Failed to fetch add-ons', { error: subError.message });
    }

    // Get all available packages
    const { data: allPackages, error: pkgError } = await adminClient
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (pkgError) {
      logger.error('Error fetching packages:', pkgError);
      return internalError('Failed to fetch packages', { error: pkgError.message });
    }

    // Determine which packages are already subscribed
    const subscribedPackageIds = new Set(subscriptions?.map((s) => s.package_id) || []);
    const availableAddons = allPackages?.filter((pkg) => !subscribedPackageIds.has(pkg.id)) || [];

    return NextResponse.json({
      current_addons: subscriptions || [],
      available_addons: availableAddons,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in GET /api/global/admin/organizations/[id]/addons:', error);
    return internalError('Failed to fetch add-ons', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/global/admin/organizations/[id]/addons
 * Add an add-on package to organization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();
    const { package_id } = body;

    if (!package_id) {
      return badRequest('Package ID is required');
    }

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', params.id)
      .single();

    if (orgError || !organization) {
      return notFound('Organization not found');
    }

    // Check if package already subscribed
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('id')
      .eq('organization_id', params.id)
      .eq('package_id', package_id)
      .maybeSingle();

    if (existingSub) {
      return badRequest('Package is already subscribed');
    }

    // Get package
    const { data: packageData, error: pkgError } = await adminClient
      .from('packages')
      .select('id, stripe_price_id, name, price_per_user_monthly')
      .eq('id', package_id)
      .single();

    if (pkgError || !packageData) {
      return badRequest('Package not found');
    }

    // Create subscription in database
    const { data: newSubscription, error: createError } = await adminClient
      .from('subscriptions')
      .insert({
        organization_id: params.id,
        package_id: package_id,
        stripe_price_id: packageData.stripe_price_id,
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating subscription:', createError);
      return internalError('Failed to add package', { error: createError.message });
    }

    // If Stripe is configured and customer exists, add to Stripe subscription
    if ((await isStripeConfigured()) && organization.stripe_customer_id && packageData.stripe_price_id) {
      try {
        const stripe = await getStripeClient();

        // Get main subscription
        const { data: mainSub } = await adminClient
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('organization_id', params.id)
          .neq('id', newSubscription.id)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (mainSub?.stripe_subscription_id) {
          // Add as subscription item
          await stripe.subscriptions.update(mainSub.stripe_subscription_id, {
            items: [
              {
                price: packageData.stripe_price_id,
              },
            ],
            proration_behavior: 'always_invoice',
          });

          // Update subscription with Stripe ID
          await adminClient
            .from('subscriptions')
            .update({
              stripe_subscription_id: mainSub.stripe_subscription_id,
            })
            .eq('id', newSubscription.id);
        } else {
          // Create new Stripe subscription for this add-on
          const stripeSubscription = await stripe.subscriptions.create({
            customer: organization.stripe_customer_id,
            items: [{ price: packageData.stripe_price_id }],
            metadata: {
              organization_id: params.id,
              package_id: package_id,
              is_addon: 'true',
            },
          });

          await adminClient
            .from('subscriptions')
            .update({
              stripe_subscription_id: stripeSubscription.id,
            })
            .eq('id', newSubscription.id);
        }
      } catch (stripeError) {
        logger.error('Error adding to Stripe:', stripeError);
        // Continue anyway - subscription is created in database
      }
    }

    return NextResponse.json({
      message: 'Add-on added successfully',
      subscription: newSubscription,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in POST /api/global/admin/organizations/[id]/addons:', error);
    return internalError('Failed to add package', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/global/admin/organizations/[id]/addons
 * Remove an add-on package
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const { searchParams } = new URL(request.url);
    const subscription_id = searchParams.get('subscription_id');

    if (!subscription_id) {
      return badRequest('Subscription ID is required');
    }

    // Get subscription
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, stripe_subscription_id, package_id')
      .eq('id', subscription_id)
      .eq('organization_id', params.id)
      .single();

    if (subError || !subscription) {
      return notFound('Subscription not found');
    }

    // Remove from Stripe if exists
    if ((await isStripeConfigured()) && subscription.stripe_subscription_id) {
      try {
        const stripe = await getStripeClient();
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeError) {
        logger.error('Error canceling Stripe subscription:', stripeError);
      }
    }

    // Delete from database
    await adminClient
      .from('subscriptions')
      .delete()
      .eq('id', subscription_id);

    return NextResponse.json({ message: 'Add-on removed successfully' });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in DELETE /api/global/admin/organizations/[id]/addons:', error);
    return internalError('Failed to remove add-on', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

