import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';
import { getStripeClient } from '@/lib/stripe/client';

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
      .select('id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_price_id, package_id, updated_at')
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
        .select('id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_price_id, package_id, updated_at')
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

    // If subscription has a Stripe subscription ID, sync latest data from Stripe
    // Only sync if data is stale (older than 5 minutes) or if force_sync query param is present
    // This prevents unnecessary Stripe API calls on every page load
    let shouldSync = false;
    if (subscription && subscription.stripe_subscription_id) {
      const searchParams = request.nextUrl.searchParams;
      const forceSync = searchParams.get('force_sync') === 'true';
      
      if (forceSync) {
        shouldSync = true; // Always sync if explicitly requested
      } else {
        // Check if subscription data is stale (older than 5 minutes)
        const updatedAt = (subscription as any).updated_at;
        if (!updatedAt) {
          shouldSync = true; // If no updated_at, sync to get it
        } else {
          const lastUpdated = new Date(updatedAt);
          const now = new Date();
          const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
          
          // Only sync if data is older than 5 minutes
          shouldSync = minutesSinceUpdate > 5;
        }
      }
    }

    if (shouldSync && subscription && subscription.stripe_subscription_id) {
      try {
        const stripe = await getStripeClient();
        if (stripe) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          const subscriptionData = stripeSubscription as any;
          
          // Convert Unix timestamps to ISO strings
          let periodStart = subscriptionData.current_period_start 
            ? new Date(subscriptionData.current_period_start * 1000).toISOString()
            : subscription.current_period_start;
          let periodEnd = subscriptionData.current_period_end 
            ? new Date(subscriptionData.current_period_end * 1000).toISOString()
            : subscription.current_period_end;
          
          // Validate and correct period end date if it seems wrong (e.g., year instead of month)
          // For monthly subscriptions, period_end should be approximately 1 month from period_start
          if (periodStart && periodEnd) {
            const startDate = new Date(periodStart);
            const endDate = new Date(periodEnd);
            const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // If the period is more than 35 days, it's likely wrong for a monthly subscription
            // Calculate correct end date: 1 month from start
            if (daysDiff > 35) {
              logger.warn('[Subscription API] Subscription period seems incorrect, correcting:', {
                subscriptionId: subscription.id,
                originalPeriodStart: periodStart,
                originalPeriodEnd: periodEnd,
                daysDiff,
              });
              
              // Calculate 1 month from start date
              const correctedEndDate = new Date(startDate);
              correctedEndDate.setMonth(correctedEndDate.getMonth() + 1);
              periodEnd = correctedEndDate.toISOString();
              
              logger.info('[Subscription API] Corrected period end date:', {
                original: endDate.toISOString(),
                corrected: periodEnd,
              });
            }
          }
          
          // Check if dates have changed before updating
          const oldPeriodStart = subscription.current_period_start;
          const oldPeriodEnd = subscription.current_period_end;
          const oldStatus = subscription.status;
          const newStatus = stripeSubscription.status as 'active' | 'canceled' | 'past_due' | 'trialing';
          
          // Always update subscription object with latest dates from Stripe for response
          subscription.current_period_start = periodStart;
          subscription.current_period_end = periodEnd;
          subscription.status = newStatus;
          subscription.cancel_at_period_end = subscriptionData.cancel_at_period_end || false;
          
          // Update database if dates or status have changed
          if (periodStart !== oldPeriodStart || periodEnd !== oldPeriodEnd || newStatus !== oldStatus) {
            logger.info('[Subscription API] Syncing subscription dates from Stripe:', {
              subscriptionId: subscription.id,
              oldPeriodStart,
              newPeriodStart: periodStart,
              oldPeriodEnd,
              newPeriodEnd: periodEnd,
              oldStatus,
              newStatus,
            });
            
            const { data: updatedSub, error: updateError } = await adminClient
              .from('subscriptions')
              .update({
                current_period_start: periodStart,
                current_period_end: periodEnd,
                status: newStatus,
                cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id)
              .select()
              .single();
            
            if (!updateError && updatedSub) {
              subscription = updatedSub;
            } else if (updateError) {
              logger.error('[Subscription API] Error updating subscription dates:', updateError);
            }
          }
        } else {
          logger.warn('[Subscription API] Stripe client not available, using database data');
        }
      } catch (stripeError) {
        logger.warn('[Subscription API] Error syncing from Stripe (continuing with DB data):', {
          error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
          subscriptionId: subscription?.id,
        });
        // Continue with database data if Stripe sync fails
      }
    }

    // Get package details if subscription exists
    if (subscription && subscription.package_id) {
      const { data: packageData, error: pkgError } = await adminClient
        .from('packages')
        .select('id, name, pricing_model, base_price_monthly, base_price_yearly, price_per_user_monthly, price_per_user_yearly, stripe_price_id_monthly, stripe_price_id_yearly, features')
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
    const { organization_id, package_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, billing_interval } = body;

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
      hasStripeSubscriptionId: !!stripe_subscription_id,
      hasSession: !!session,
      billing_interval,
      status,
      hasPeriodStart: !!current_period_start,
      hasPeriodEnd: !!current_period_end,
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
        .select('id, organization_id, status, package_id, stripe_price_id, billing_interval, current_period_start, current_period_end')
        .eq('stripe_subscription_id', stripe_subscription_id)
        .maybeSingle();

      if (existingSubByStripe) {
        // CRITICAL: If subscription exists but has wrong organization_id, update it
        if (existingSubByStripe.organization_id !== organization_id) {
          logger.warn('[Subscription API] Subscription found with wrong organization_id, updating:', {
            subscriptionId: existingSubByStripe.id,
            stripeSubscriptionId: stripe_subscription_id,
            currentOrgId: existingSubByStripe.organization_id,
            correctOrgId: organization_id,
          });
          
          // Update organization_id to correct one
          const { error: orgUpdateError } = await adminClient
            .from('subscriptions')
            .update({ organization_id: organization_id })
            .eq('id', existingSubByStripe.id);
          
          if (orgUpdateError) {
            logger.error('[Subscription API] Failed to update subscription organization_id:', orgUpdateError);
            return internalError('Failed to update subscription organization', { error: orgUpdateError.message });
          }
          
          logger.info('[Subscription API] Successfully updated subscription organization_id:', {
            subscriptionId: existingSubByStripe.id,
            newOrgId: organization_id,
          });
        }
        
        // Subscription already exists - update it with latest data
        logger.info('[Subscription API] Subscription exists by stripe_subscription_id, updating:', {
          subscriptionId: existingSubByStripe.id,
          stripeSubscriptionId: stripe_subscription_id,
          organizationId: organization_id,
        });

        const subscriptionStatus = status || existingSubByStripe.status || 'active';
        
        // Validate dates if provided
        let periodStart: string;
        let periodEnd: string;
        const subscriptionBillingIntervalForUpdate = billing_interval || existingSubByStripe.billing_interval || 'month';
        
        if (current_period_start) {
          const startDate = new Date(current_period_start);
          if (startDate.getTime() === 0 || startDate.getFullYear() < 2020 || isNaN(startDate.getTime())) {
            logger.warn('[Subscription API] Invalid current_period_start in update, using fallback');
            periodStart = new Date().toISOString();
          } else {
            periodStart = current_period_start;
          }
        } else {
          periodStart = existingSubByStripe.current_period_start || new Date().toISOString();
        }
        
        if (current_period_end) {
          const endDate = new Date(current_period_end);
          if (endDate.getTime() === 0 || endDate.getFullYear() < 2020 || isNaN(endDate.getTime())) {
            logger.warn('[Subscription API] Invalid current_period_end in update, calculating fallback');
            const startDateObj = new Date(periodStart);
            if (subscriptionBillingIntervalForUpdate === 'year') {
              startDateObj.setFullYear(startDateObj.getFullYear() + 1);
            } else {
              startDateObj.setMonth(startDateObj.getMonth() + 1);
            }
            periodEnd = startDateObj.toISOString();
          } else {
            periodEnd = current_period_end;
          }
        } else {
          periodEnd = existingSubByStripe.current_period_end || (() => {
            const startDateObj = new Date(periodStart);
            if (subscriptionBillingIntervalForUpdate === 'year') {
              startDateObj.setFullYear(startDateObj.getFullYear() + 1);
            } else {
              startDateObj.setMonth(startDateObj.getMonth() + 1);
            }
            return startDateObj.toISOString();
          })();
        }

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
        
        // Always update billing_interval if provided (important for new subscriptions)
        if (billing_interval) {
          updateData.billing_interval = billing_interval;
          logger.info('[Subscription API] Updating subscription billing_interval:', {
            subscriptionId: existingSubByStripe.id,
            billingInterval: billing_interval,
          });
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

        // Update organization status to active when subscription is active/trialing
        const orgStatus = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'active' : 'trial';
        const { error: orgUpdateError } = await adminClient
          .from('organizations')
          .update({
            subscription_status: orgStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', organization_id);

        if (orgUpdateError) {
          logger.error('[Subscription API] Error updating organization status:', orgUpdateError);
        } else {
          logger.info('[Subscription API] Updated organization status:', {
            organizationId: organization_id,
            status: orgStatus,
          });
        }

        return NextResponse.json(updatedSub, { status: 200 });
      }
    }

    // Check if subscription already exists for this organization (active or trialing)
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('id, stripe_subscription_id, package_id, status')
      .eq('organization_id', organization_id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (existingSub) {
      // If existing subscription doesn't have stripe_subscription_id, update it
      if (stripe_subscription_id && !existingSub.stripe_subscription_id) {
        logger.info('[Subscription API] Updating existing subscription with Stripe subscription ID:', {
          subscriptionId: existingSub.id,
          stripeSubscriptionId: stripe_subscription_id,
        });
        
        const updateData: any = {
          stripe_subscription_id: stripe_subscription_id,
          updated_at: new Date().toISOString(),
        };
        
        // Update package_id if provided and different
        if (package_id && existingSub.package_id !== package_id) {
          updateData.package_id = package_id;
        }
        
        // Update stripe_price_id if provided
        if (stripe_price_id) {
          updateData.stripe_price_id = stripe_price_id;
        }
        
        // Update billing_interval if provided
        if (billing_interval) {
          updateData.billing_interval = billing_interval;
        }
        
        // Update status if provided
        if (status) {
          updateData.status = status;
        }
        
        // Update dates if provided
        if (current_period_start) {
          updateData.current_period_start = current_period_start;
        }
        if (current_period_end) {
          updateData.current_period_end = current_period_end;
        }
        
        const { data: updatedSub, error: updateError } = await adminClient
          .from('subscriptions')
          .update(updateData)
          .eq('id', existingSub.id)
          .select()
          .single();
        
        if (updateError) {
          logger.error('[Subscription API] Error updating existing subscription with Stripe ID:', updateError);
          return internalError('Failed to update subscription', { error: updateError.message });
        }
        
        // Update organization status to active
        const orgStatus = (status || updatedSub.status) === 'active' || (status || updatedSub.status) === 'trialing' ? 'active' : 'trial';
        const { error: orgUpdateError } = await adminClient
          .from('organizations')
          .update({
            subscription_status: orgStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', organization_id);
        
        if (orgUpdateError) {
          logger.error('[Subscription API] Error updating organization status:', orgUpdateError);
        } else {
          logger.info('[Subscription API] Updated organization status after subscription update:', {
            organizationId: organization_id,
            status: orgStatus,
          });
        }
        
        return NextResponse.json(updatedSub, { status: 200 });
      }
      
      // If we have a stripe_subscription_id but it doesn't match, log warning
      if (stripe_subscription_id && existingSub.stripe_subscription_id !== stripe_subscription_id) {
        logger.warn('[Subscription API] Organization has existing subscription with different Stripe ID:', {
          organizationId: organization_id,
          existingStripeId: existingSub.stripe_subscription_id,
          newStripeId: stripe_subscription_id,
        });
      }
      
      // If subscription already has stripe_subscription_id and it matches, return it
      if (stripe_subscription_id && existingSub.stripe_subscription_id === stripe_subscription_id) {
        logger.info('[Subscription API] Subscription already exists with matching Stripe ID:', {
          subscriptionId: existingSub.id,
          stripeSubscriptionId: stripe_subscription_id,
        });
        return NextResponse.json(existingSub, { status: 200 });
      }
      
      return badRequest('Organization already has an active or trialing subscription');
    }

    // Create subscription
    // Use provided dates/status if available (from Stripe), otherwise use defaults
    const subscriptionStatus = status || (stripe_subscription_id ? 'active' : 'trialing');
    // Default to 'month' if billing_interval not provided (backward compatibility)
    const subscriptionBillingInterval = billing_interval || 'month';
    
    // Validate and set period dates
    let periodStart: string;
    let periodEnd: string;
    
    if (current_period_start) {
      // Validate the provided date is not epoch 0 or invalid
      const startDate = new Date(current_period_start);
      if (startDate.getTime() === 0 || startDate.getFullYear() < 2020 || isNaN(startDate.getTime())) {
        logger.warn('[Subscription API] Invalid current_period_start provided, using fallback:', {
          providedDate: current_period_start,
          dateValue: startDate.getTime(),
        });
        periodStart = new Date().toISOString();
      } else {
        periodStart = current_period_start;
      }
    } else {
      periodStart = new Date().toISOString();
    }
    
    if (current_period_end) {
      // Validate the provided date is not epoch 0 or invalid
      const endDate = new Date(current_period_end);
      if (endDate.getTime() === 0 || endDate.getFullYear() < 2020 || isNaN(endDate.getTime())) {
        logger.warn('[Subscription API] Invalid current_period_end provided, using calculated fallback:', {
          providedDate: current_period_end,
          dateValue: endDate.getTime(),
        });
        // Calculate end date based on billing interval
        const startDateObj = new Date(periodStart);
        if (subscriptionBillingInterval === 'year') {
          startDateObj.setFullYear(startDateObj.getFullYear() + 1);
        } else {
          startDateObj.setMonth(startDateObj.getMonth() + 1);
        }
        periodEnd = startDateObj.toISOString();
      } else {
        periodEnd = current_period_end;
      }
    } else {
      // Calculate end date based on billing interval
      const startDateObj = new Date(periodStart);
      if (subscriptionBillingInterval === 'year') {
        startDateObj.setFullYear(startDateObj.getFullYear() + 1);
      } else {
        startDateObj.setMonth(startDateObj.getMonth() + 1);
      }
      periodEnd = startDateObj.toISOString();
    }
    
    logger.info('[Subscription API] Validated subscription dates:', {
      periodStart,
      periodEnd,
      billingInterval: subscriptionBillingInterval,
      hadProvidedDates: !!(current_period_start && current_period_end),
    });

    logger.info('[Subscription API] Inserting new subscription:', {
      organization_id,
      package_id,
      stripe_subscription_id: stripe_subscription_id || null,
      stripe_price_id: stripe_price_id || null,
      billing_interval: subscriptionBillingInterval,
      status: subscriptionStatus,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .insert({
        organization_id,
        package_id,
        stripe_subscription_id: stripe_subscription_id || null,
        stripe_price_id: stripe_price_id || null,
        billing_interval: subscriptionBillingInterval,
        status: subscriptionStatus,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (subError) {
      logger.error('[Subscription API] Error creating subscription:', {
        error: subError.message,
        errorCode: subError.code,
        errorDetails: subError.details,
        organization_id,
        package_id,
        stripe_subscription_id,
      });
      return internalError('Failed to create subscription', { error: subError.message });
    }
    
    logger.info('[Subscription API] Successfully created subscription:', {
      subscriptionId: subscription.id,
      organizationId: subscription.organization_id,
      packageId: subscription.package_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      status: subscription.status,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
    });

    // Use packageData from earlier validation (already fetched with price_per_user_monthly)

    // For free packages, set to active immediately (no payment needed)
    // For paid packages with Stripe subscription, set to active
    // For paid packages without Stripe subscription, keep in trial
    // Use the subscription status if provided, otherwise determine from package
    const orgStatus = status === 'active' || status === 'trialing'
      ? 'active'
      : (packageData && packageData.price_per_user_monthly === 0) || stripe_subscription_id
        ? 'active' 
        : 'trial';

    // Update organization subscription status
    // Note: organizations.subscription_status uses 'trial' (not 'trialing')
    // When stripe_subscription_id is present, always set to active (payment was successful)
    const finalOrgStatus = stripe_subscription_id ? 'active' : orgStatus;
    
    const { error: orgUpdateError } = await adminClient
      .from('organizations')
      .update({
        subscription_status: finalOrgStatus,
        trial_ends_at: finalOrgStatus === 'trial' 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    if (orgUpdateError) {
      logger.error('[Subscription API] Error updating organization status:', orgUpdateError);
    } else {
      logger.info('[Subscription API] Updated organization status after subscription creation:', {
        organizationId: organization_id,
        status: finalOrgStatus,
        hasStripeSubscription: !!stripe_subscription_id,
      });
    }

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/organization/subscription:', error);
    return internalError('Failed to create subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
