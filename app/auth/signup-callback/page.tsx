'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import logger from '@/lib/utils/logger';

function SignupCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const supabase = createSupabaseClient();

  useEffect(() => {
    const completeSignup = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        if (!sessionId) {
          setError('Missing session ID');
          setLoading(false);
          return;
        }

        // Get signup data from sessionStorage
        const signupDataStr = sessionStorage.getItem('signup_data');
        if (!signupDataStr) {
          setError('Signup data not found. Please try signing up again.');
          setLoading(false);
          return;
        }

        const signupData = JSON.parse(signupDataStr);
        const { email, password, name, organizationName, packageId, userQuantity = 1, billingInterval } = signupData;
        
        // Log signup data for debugging
        logger.info('[SignupCallback] Signup data retrieved:', {
          email,
          organizationName,
          packageId,
          hasPackageId: !!packageId,
        });

        // Verify data is not too old (max 1 hour)
        if (Date.now() - signupData.timestamp > 60 * 60 * 1000) {
          sessionStorage.removeItem('signup_data');
          setError('Signup session expired. Please try again.');
          setLoading(false);
          return;
        }

        // Step 1: Create organization (idempotent - API handles duplicate check)
        const orgSlug = organizationName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const orgResponse = await fetch('/api/auth/create-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: organizationName,
            slug: orgSlug,
          }),
        });

        if (!orgResponse.ok) {
          const errorData = await orgResponse.json();
          // If organization creation failed, try to find it by name as fallback
          // This handles edge cases where organization exists but API returned error
          
          // For now, throw the error - the API should handle idempotency
          // But if it's a duplicate error, we should be able to continue
          if (errorData.message?.includes('already exists')) {
            // Organization exists - we need to find it, but we don't have auth yet
            // This is a rare edge case - log it and throw a more helpful error
            throw new Error('Organization already exists. Please try signing in instead, or contact support if you just completed payment.');
          }
          
          throw new Error(errorData.message || 'Failed to create organization');
        }

        const { organization: orgData } = await orgResponse.json();
        
        if (!orgData || !orgData.id) {
          throw new Error('Organization was created but data is missing. Please try signing in.');
        }

        // Log organization creation for tracking
        logger.info('[SignupCallback] Organization created/retrieved:', {
          organizationId: orgData.id,
          organizationName: orgData.name,
          organizationSlug: orgData.slug,
        });

        // Step 2: Sign up user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role: 'admin',
              organization_id: orgData.id,
            },
          },
        });

        if (signUpError) {
          throw new Error(signUpError.message);
        }

        if (!authData.user) {
          throw new Error('Failed to create user account');
        }

        // Step 3: Wait for session (with retries)
        let session = authData.session;
        if (!session) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          session = retrySession;
        }

        if (!session) {
          // If still no session, user needs to confirm email
          // Show a friendly message instead of redirecting immediately
          setNeedsEmailConfirmation(true);
          setLoading(false);
          // Keep signup_data in sessionStorage so they can complete after email confirmation
          return;
        }

        // Step 4: Create user record
        logger.info('[SignupCallback] Creating user record with organization:', {
          email,
          organizationId: orgData.id,
        });

        const userResponse = await fetch('/api/auth/create-user-with-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name,
            role: 'admin',
            organization_id: orgData.id,
          }),
        });

        if (!userResponse.ok) {
          const errorData = await userResponse.json();
          logger.error('[SignupCallback] Failed to create user record:', {
            error: errorData.error,
            organizationId: orgData.id,
            email,
          });
          throw new Error(errorData.error || 'Failed to create user record');
        }

        // Verify user was assigned to correct organization
        const { user: createdUser } = await userResponse.json();
        if (!createdUser) {
          logger.error('[SignupCallback] User creation returned no user data');
          throw new Error('User record creation failed. Please try signing in.');
        }

        if (createdUser.organization_id !== orgData.id) {
          logger.error('[SignupCallback] Organization assignment mismatch:', {
            expectedOrgId: orgData.id,
            actualOrgId: createdUser.organization_id,
            userId: createdUser.id,
            email,
          });
          throw new Error('User was assigned to incorrect organization. Please contact support.');
        }

        logger.info('[SignupCallback] User successfully created and assigned to organization:', {
          userId: createdUser.id,
          email: createdUser.email,
          organizationId: createdUser.organization_id,
          role: createdUser.role,
        });

        // Step 5: Create subscription and update organization with Stripe data
        // The subscription was already created by Stripe, we just need to link it
        // CRITICAL: Subscription creation must succeed - user has already paid
        // IDEMPOTENCY: Check if subscription already exists (webhook might have created it)
        
        // Get Stripe subscription and customer from checkout session
        logger.info('[SignupCallback] Fetching checkout session:', {
          sessionId,
          organizationId: orgData.id,
        });
        
        const stripeResponse = await fetch(`/api/stripe/get-checkout-session?session_id=${sessionId}`);
        if (!stripeResponse.ok) {
          const errorData = await stripeResponse.json().catch(() => ({ error: 'Failed to fetch checkout session' }));
          logger.error('[SignupCallback] Failed to fetch checkout session:', {
            error: errorData.error,
            sessionId,
            organizationId: orgData.id,
            responseStatus: stripeResponse.status,
          });
          throw new Error('Failed to retrieve payment information. Please contact support if this issue persists.');
        }

        const { subscription_id, customer_id, subscription } = await stripeResponse.json();
        
        logger.info('[SignupCallback] Retrieved checkout session data:', {
          hasSubscriptionId: !!subscription_id,
          hasCustomerId: !!customer_id,
          subscriptionId: subscription_id,
          customerId: customer_id,
          organizationId: orgData.id,
        });
        
        if (!subscription_id || !customer_id) {
          logger.error('[SignupCallback] Missing subscription or customer ID from checkout session:', {
            sessionId,
            hasSubscriptionId: !!subscription_id,
            hasCustomerId: !!customer_id,
          });
          throw new Error('Payment information is incomplete. Please contact support.');
        }

        // Update organization with Stripe customer ID (non-critical, but log failures)
        const customerUpdateResponse = await fetch('/api/organization/update-stripe-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: orgData.id,
            stripe_customer_id: customer_id,
          }),
        });
        
        if (!customerUpdateResponse.ok) {
          logger.warn('[SignupCallback] Failed to update customer ID (may already be set):', {
            organizationId: orgData.id,
            customerId: customer_id,
          });
        }

        // Get full subscription details from Stripe
        const fullSubscriptionResponse = await fetch(`/api/stripe/get-subscription?subscription_id=${subscription_id}`);
        let fullSubscription = null;
        if (fullSubscriptionResponse.ok) {
          fullSubscription = await fullSubscriptionResponse.json();
        } else {
          logger.warn('[SignupCallback] Failed to fetch full subscription details, using checkout session data');
        }

        // Create subscription record with full details (API route handles idempotency)
        if (!packageId) {
          logger.error('[SignupCallback] Missing packageId in signup data, cannot create subscription');
          throw new Error('Package ID is missing. Please try signing up again.');
        }
        
        // Extract billing_interval from Stripe subscription metadata, price recurring interval, or signup data
        let subscriptionBillingInterval: 'month' | 'year' = 'month';
        if (fullSubscription?.items?.[0]?.price?.recurring?.interval) {
          subscriptionBillingInterval = fullSubscription.items[0].price.recurring.interval as 'month' | 'year';
        } else if (billingInterval) {
          subscriptionBillingInterval = billingInterval as 'month' | 'year';
        }
        
        logger.info('[SignupCallback] Creating subscription with package:', {
          organizationId: orgData.id,
          packageId,
          subscriptionId: subscription_id,
          billingInterval: subscriptionBillingInterval,
        });
        
        // Extract and validate dates from Stripe subscription
        let periodStart: string;
        let periodEnd: string;
        
        // Try to get dates from fullSubscription first (most reliable)
        if (fullSubscription?.current_period_start && typeof fullSubscription.current_period_start === 'number' && fullSubscription.current_period_start > 0) {
          periodStart = new Date(fullSubscription.current_period_start * 1000).toISOString();
        } else if (subscription?.current_period_start && typeof subscription.current_period_start === 'number' && subscription.current_period_start > 0) {
          periodStart = new Date(subscription.current_period_start * 1000).toISOString();
        } else {
          // Fallback: use current time
          periodStart = new Date().toISOString();
          logger.warn('[SignupCallback] Using fallback for current_period_start - Stripe did not provide valid date');
        }
        
        if (fullSubscription?.current_period_end && typeof fullSubscription.current_period_end === 'number' && fullSubscription.current_period_end > 0) {
          periodEnd = new Date(fullSubscription.current_period_end * 1000).toISOString();
        } else if (subscription?.current_period_end && typeof subscription.current_period_end === 'number' && subscription.current_period_end > 0) {
          periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } else {
          // Fallback: calculate end date based on billing interval
          const startDate = new Date(periodStart);
          if (subscriptionBillingInterval === 'year') {
            startDate.setFullYear(startDate.getFullYear() + 1);
          } else {
            startDate.setMonth(startDate.getMonth() + 1);
          }
          periodEnd = startDate.toISOString();
          logger.warn('[SignupCallback] Using calculated fallback for current_period_end - Stripe did not provide valid date');
        }
        
        // Validate dates are not epoch 0 (January 1, 1970)
        const startDateObj = new Date(periodStart);
        const endDateObj = new Date(periodEnd);
        if (startDateObj.getTime() === 0 || startDateObj.getFullYear() < 2020) {
          logger.error('[SignupCallback] Invalid period_start date detected, using fallback:', {
            originalDate: periodStart,
            dateValue: startDateObj.getTime(),
          });
          periodStart = new Date().toISOString();
        }
        if (endDateObj.getTime() === 0 || endDateObj.getFullYear() < 2020) {
          logger.error('[SignupCallback] Invalid period_end date detected, using fallback:', {
            originalDate: periodEnd,
            dateValue: endDateObj.getTime(),
          });
          const fallbackStart = new Date(periodStart);
          if (subscriptionBillingInterval === 'year') {
            fallbackStart.setFullYear(fallbackStart.getFullYear() + 1);
          } else {
            fallbackStart.setMonth(fallbackStart.getMonth() + 1);
          }
          periodEnd = fallbackStart.toISOString();
        }
        
        logger.info('[SignupCallback] Subscription dates prepared:', {
          periodStart,
          periodEnd,
          billingInterval: subscriptionBillingInterval,
          fromFullSubscription: !!fullSubscription?.current_period_start,
        });
        
        const subscriptionData = {
          organization_id: orgData.id,
          package_id: packageId,
          stripe_subscription_id: subscription_id,
          stripe_price_id: fullSubscription?.items?.[0]?.price?.id || null,
          billing_interval: subscriptionBillingInterval,
          status: (fullSubscription?.status || subscription?.status) === 'active' ? 'active' : 'trialing',
          current_period_start: periodStart,
          current_period_end: periodEnd,
        };

        // CRITICAL: Subscription creation must succeed - retry once if it fails
        let subCreateResponse = await fetch('/api/organization/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionData),
        });

        // If first attempt fails, retry once (webhook might be processing)
        if (!subCreateResponse.ok) {
          const errorData = await subCreateResponse.json();
          logger.warn('[SignupCallback] First subscription creation attempt failed, retrying:', {
            error: errorData.error,
            subscriptionId: subscription_id,
            organizationId: orgData.id,
          });
          
          // Wait 2 seconds and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          subCreateResponse = await fetch('/api/organization/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscriptionData),
          });
        }

        if (!subCreateResponse.ok) {
          const errorData = await subCreateResponse.json();
          logger.error('[SignupCallback] Failed to create/update subscription after retry:', {
            error: errorData.error,
            subscriptionId: subscription_id,
            organizationId: orgData.id,
            packageId,
          });
          
          // If subscription already exists (webhook created it), verify it exists
          if (errorData.error?.includes('already has')) {
            logger.info('[SignupCallback] Subscription may already exist, verifying...');
            // Verify subscription exists in database
            const verifyResponse = await fetch(`/api/organization/subscription`);
            if (verifyResponse.ok) {
              const { subscription: existingSub } = await verifyResponse.json();
              if (existingSub && existingSub.stripe_subscription_id === subscription_id) {
                logger.info('[SignupCallback] Subscription verified, continuing signup');
                // Subscription exists and matches - continue
              } else {
                throw new Error('Subscription creation failed. Please contact support with your payment confirmation.');
              }
            } else {
              throw new Error('Subscription creation failed. Please contact support with your payment confirmation.');
            }
          } else {
            throw new Error('Failed to create subscription. Please contact support with your payment confirmation.');
          }
        } else {
          const createdSub = await subCreateResponse.json();
          logger.info('[SignupCallback] Successfully created/updated subscription:', {
            subscriptionId: createdSub.id,
            stripeSubscriptionId: createdSub.stripe_subscription_id,
            organizationId: orgData.id,
          });
          
          // Verify subscription was actually created
          if (!createdSub || !createdSub.id) {
            logger.error('[SignupCallback] Subscription creation returned invalid data:', createdSub);
            throw new Error('Subscription creation verification failed. Please contact support.');
          }
          
          // CRITICAL: Verify subscription exists in database by querying it
          const verifySubResponse = await fetch(`/api/organization/subscription`);
          if (verifySubResponse.ok) {
            const { subscription: verifiedSub } = await verifySubResponse.json();
            if (verifiedSub && verifiedSub.id === createdSub.id && verifiedSub.stripe_subscription_id === subscription_id) {
              logger.info('[SignupCallback] Subscription verified in database:', {
                subscriptionId: verifiedSub.id,
                organizationId: verifiedSub.organization_id,
                stripeSubscriptionId: verifiedSub.stripe_subscription_id,
                hasPeriodStart: !!verifiedSub.current_period_start,
                hasPeriodEnd: !!verifiedSub.current_period_end,
              });
            } else {
              logger.error('[SignupCallback] Subscription verification failed - data mismatch:', {
                createdSubId: createdSub.id,
                verifiedSubId: verifiedSub?.id,
                createdStripeId: createdSub.stripe_subscription_id,
                verifiedStripeId: verifiedSub?.stripe_subscription_id,
              });
              throw new Error('Subscription was created but verification failed. Please contact support.');
            }
          } else {
            logger.warn('[SignupCallback] Could not verify subscription in database (may need to refresh)');
            // Don't fail signup if verification query fails - subscription was created
          }
        }

        // IDEMPOTENCY: Update organization status to active
        // The update-status API will check current status and prevent downgrades
        const statusUpdateResponse = await fetch('/api/organization/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: orgData.id,
            subscription_status: 'active',
          }),
        });

        if (!statusUpdateResponse.ok) {
          const statusError = await statusUpdateResponse.json();
          // If status update was skipped (already active), that's fine
          if (!statusError.skipped) {
            logger.warn('[SignupCallback] Failed to update organization status:', {
              organizationId: orgData.id,
              error: statusError.error,
            });
            // Non-critical, but log it
          }
        }

        // Step 6: Store user quantity for invite prompt (if more than 1 user was purchased)
        if (userQuantity > 1) {
          sessionStorage.setItem('pending_user_invites', JSON.stringify({
            quantity: userQuantity,
            organizationId: orgData.id,
            timestamp: Date.now(),
          }));
        }

        // Step 7: Clean up and redirect
        sessionStorage.removeItem('signup_data');
        sessionStorage.removeItem('selectedPackageId');
        router.push('/dashboard?invite_users=true');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
        sessionStorage.removeItem('signup_data');
      }
    };

    completeSignup();
  }, [searchParams, router, supabase]);

  if (needsEmailConfirmation) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Alert severity="info" sx={{ mb: 2, maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Please confirm your email
          </Typography>
          <Typography variant="body2">
            We&apos;ve sent a confirmation email to your inbox. Please check your email and click the confirmation link to complete your signup.
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Once you&apos;ve confirmed your email, you can sign in and your account will be fully activated.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          onClick={() => router.push('/auth/signin')}
          sx={{ mt: 2 }}
        >
          Go to Sign In
        </Button>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ mb: 2, maxWidth: 500 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Redirecting to signup page...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress sx={{ mb: 2 }} />
      <Typography variant="h6">Completing your signup...</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Please wait while we set up your account
      </Typography>
    </Box>
  );
}

export default function SignupCallbackPage() {
  return (
    <Suspense fallback={
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6">Loading...</Typography>
      </Box>
    }>
      <SignupCallbackPageContent />
    </Suspense>
  );
}

