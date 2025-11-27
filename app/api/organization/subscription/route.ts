import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/subscription
 * Get current organization's subscription details
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();

    // First, try to get active or trialing subscription
    let { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_price_id, package_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no active/trialing subscription, get the most recent subscription regardless of status
    if (!subscription && subError?.code === 'PGRST116') {
      logger.info('[Subscription API] No active/trialing subscription found, checking for any subscription');
      const { data: anySubscription, error: anySubError } = await adminClient
        .from('subscriptions')
        .select('id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_price_id, package_id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anySubscription) {
        subscription = anySubscription;
        subError = null;
        logger.info('[Subscription API] Found subscription with status:', subscription.status);
      } else if (anySubError && anySubError.code !== 'PGRST116') {
        logger.error('[Subscription API] Error loading any subscription:', anySubError);
        subError = anySubError;
      }
    }

    // Get package details if subscription exists
    if (subscription && subscription.package_id) {
      const { data: packageData, error: pkgError } = await adminClient
        .from('packages')
        .select('id, name, price_per_user_monthly, features')
        .eq('id', subscription.package_id)
        .single();

      if (packageData) {
        (subscription as any).package = packageData;
      } else if (pkgError) {
        logger.warn('[Subscription API] Package not found for subscription:', {
          subscriptionId: subscription.id,
          packageId: subscription.package_id,
          error: pkgError.message
        });
      }
    }

    // Log if there's an error (but don't fail if it's just "not found")
    if (subError && subError.code !== 'PGRST116') {
      logger.error('[Subscription API] Error loading subscription:', subError);
      return internalError('Failed to load subscription', { error: subError.message });
    }

    logger.info('[Subscription API] Returning subscription data', {
      organizationId,
      hasSubscription: !!subscription,
      status: subscription?.status || 'none'
    });

    return NextResponse.json({ subscription: subscription || null });
  } catch (error) {
    logger.error('Error in GET /api/organization/subscription:', error);
    return internalError('Failed to load subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/organization/subscription
 * Create a subscription for an organization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    const body = await request.json();
    const { organization_id, package_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end } = body;

    if (!organization_id) {
      return badRequest('Missing required field: organization_id');
    }
    
    if (!package_id) {
      logger.error('[Subscription API] Missing package_id when creating subscription:', {
        organization_id,
        stripe_subscription_id,
      });
      return badRequest('Missing required field: package_id. Package must be specified when creating a subscription.');
    }
    
    const adminClient = createAdminSupabaseClient();
    
    // Verify package exists and get price info
    const { data: packageData, error: pkgError } = await adminClient
      .from('packages')
      .select('id, name, price_per_user_monthly')
      .eq('id', package_id)
      .maybeSingle();
    
    if (pkgError || !packageData) {
      logger.error('[Subscription API] Package not found:', {
        package_id,
        error: pkgError?.message,
      });
      return badRequest(`Package not found: ${package_id}`);
    }
    
    logger.info('[Subscription API] Creating/updating subscription with package:', {
      organization_id,
      package_id,
      package_name: packageData.name,
      stripe_subscription_id,
    });

    // During signup (when stripe_subscription_id is provided), allow without auth
    // Otherwise, require authentication
    if (!stripe_subscription_id && !session) {
      return unauthorized('You must be logged in to create a subscription');
    }

    // If authenticated, verify organization access
    if (session && !stripe_subscription_id) {
      const userOrgId = await getUserOrganizationId(supabase, session.user.id);
      if (userOrgId !== organization_id) {
        return badRequest('You can only create subscriptions for your own organization');
      }
    }

    // IDEMPOTENCY: Check if subscription already exists by stripe_subscription_id first (most reliable)
    if (stripe_subscription_id) {
      const { data: existingSubByStripe } = await adminClient
        .from('subscriptions')
        .select('id, organization_id, status, package_id, stripe_price_id')
        .eq('stripe_subscription_id', stripe_subscription_id)
        .maybeSingle();

      if (existingSubByStripe) {
        // Subscription already exists - update it with latest data
        logger.info('[Subscription API] Subscription exists by stripe_subscription_id, updating:', {
          subscriptionId: existingSubByStripe.id,
          stripeSubscriptionId: stripe_subscription_id,
        });

        const subscriptionStatus = status || existingSubByStripe.status || 'active';
        const periodStart = current_period_start || new Date().toISOString();
        const periodEnd = current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Build update object - always update package_id if provided, otherwise preserve existing
        const updateData: any = {
          status: subscriptionStatus,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        };
        
        // Always update package_id if provided in request
        if (package_id) {
          updateData.package_id = package_id;
          logger.info('[Subscription API] Updating subscription package_id:', {
            subscriptionId: existingSubByStripe.id,
            packageId: package_id,
            previousPackageId: existingSubByStripe.package_id,
          });
        } else if (!existingSubByStripe.package_id) {
          // If no package_id provided and subscription doesn't have one, log warning
          logger.warn('[Subscription API] Subscription update without package_id and subscription has no package_id:', {
            subscriptionId: existingSubByStripe.id,
          });
        }
        
        // Update stripe_price_id if provided, otherwise preserve existing
        if (stripe_price_id) {
          updateData.stripe_price_id = stripe_price_id;
        } else if (existingSubByStripe.stripe_price_id) {
          // Preserve existing if not provided
          updateData.stripe_price_id = existingSubByStripe.stripe_price_id;
        }
        
        const { data: updatedSub, error: updateError } = await adminClient
          .from('subscriptions')
          .update(updateData)
          .eq('id', existingSubByStripe.id)
          .select()
          .single();

        if (updateError) {
          logger.error('[Subscription API] Error updating existing subscription:', updateError);
          return internalError('Failed to update subscription', { error: updateError.message });
        }

        // Update organization status
        const orgStatus = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'active' : 'trial';
        await adminClient
          .from('organizations')
          .update({
            subscription_status: orgStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', organization_id);

        return NextResponse.json(updatedSub, { status: 200 });
      }
    }

    // Check if subscription already exists for this organization (active or trialing)
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('id, stripe_subscription_id')
      .eq('organization_id', organization_id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (existingSub) {
      // If we have a stripe_subscription_id but it doesn't match, log warning
      if (stripe_subscription_id && existingSub.stripe_subscription_id !== stripe_subscription_id) {
        logger.warn('[Subscription API] Organization has existing subscription with different Stripe ID:', {
          organizationId: organization_id,
          existingStripeId: existingSub.stripe_subscription_id,
          newStripeId: stripe_subscription_id,
        });
      }
      return badRequest('Organization already has an active or trialing subscription');
    }

    // Create subscription
    // Use provided dates/status if available (from Stripe), otherwise use defaults
    const subscriptionStatus = status || (stripe_subscription_id ? 'active' : 'trialing');
    const periodStart = current_period_start || new Date().toISOString();
    const periodEnd = current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .insert({
        organization_id,
        package_id,
        stripe_subscription_id: stripe_subscription_id || null,
        stripe_price_id: stripe_price_id || null,
        status: subscriptionStatus,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (subError) {
      logger.error('Error creating subscription:', subError);
      return internalError('Failed to create subscription', { error: subError.message });
    }

    // Use packageData from earlier validation (already fetched with price_per_user_monthly)

    // For free packages, set to active immediately (no payment needed)
    // For paid packages with Stripe subscription, set to active
    // For paid packages without Stripe subscription, keep in trial
    // Use the subscription status if provided, otherwise determine from package
    const orgStatus = status === 'active' 
      ? 'active'
      : (packageData && packageData.price_per_user_monthly === 0) || stripe_subscription_id
        ? 'active' 
        : 'trial';

    // Update organization subscription status
    // Note: organizations.subscription_status uses 'trial' (not 'trialing')
    await adminClient
      .from('organizations')
      .update({
        subscription_status: orgStatus,
        trial_ends_at: orgStatus === 'trial' 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/organization/subscription:', error);
    return internalError('Failed to create subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
