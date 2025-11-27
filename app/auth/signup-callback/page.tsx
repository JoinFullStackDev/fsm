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
        const { email, password, name, organizationName, packageId } = signupData;
        
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
          console.warn('[SignupCallback] Organization creation failed, attempting to find existing:', {
            error: errorData.message,
            organizationName,
          });
          
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
          throw new Error(errorData.error || 'Failed to create user record');
        }

        // Step 5: Create subscription and update organization with Stripe data
        // The subscription was already created by Stripe, we just need to link it
        // IDEMPOTENCY: Check if subscription already exists (webhook might have created it)
        try {
          // Get Stripe subscription and customer from checkout session
          const stripeResponse = await fetch(`/api/stripe/get-checkout-session?session_id=${sessionId}`);
          if (stripeResponse.ok) {
            const { subscription_id, customer_id, subscription } = await stripeResponse.json();
            
            if (subscription_id && customer_id) {
              // IDEMPOTENCY: Update organization with Stripe customer ID (only if not already set)
              const customerUpdateResponse = await fetch('/api/organization/update-stripe-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  organization_id: orgData.id,
                  stripe_customer_id: customer_id,
                }),
              });
              
              if (!customerUpdateResponse.ok) {
                console.warn('[SignupCallback] Failed to update customer ID (may already be set)');
              }

              // IDEMPOTENCY: Check if subscription already exists before creating
              const existingSubResponse = await fetch('/api/organization/subscription');
              let subscriptionExists = false;
              if (existingSubResponse.ok) {
                const subData = await existingSubResponse.json();
                if (subData.subscription && subData.subscription.stripe_subscription_id === subscription_id) {
                  subscriptionExists = true;
                  console.log('[SignupCallback] Subscription already exists, skipping creation:', subscription_id);
                }
              }

              if (!subscriptionExists) {
                // Get full subscription details from Stripe
                const fullSubscriptionResponse = await fetch(`/api/stripe/get-subscription?subscription_id=${subscription_id}`);
                let fullSubscription = null;
                if (fullSubscriptionResponse.ok) {
                  fullSubscription = await fullSubscriptionResponse.json();
                }

                // Create subscription record with full details (API route handles idempotency)
                if (!packageId) {
                  logger.error('[SignupCallback] Missing packageId in signup data, cannot create subscription');
                  throw new Error('Package ID is missing. Please try signing up again.');
                }
                
                logger.info('[SignupCallback] Creating subscription with package:', {
                  organizationId: orgData.id,
                  packageId,
                  subscriptionId: subscription_id,
                });
                
                const subscriptionData = {
                  organization_id: orgData.id,
                  package_id: packageId,
                  stripe_subscription_id: subscription_id,
                  stripe_price_id: fullSubscription?.items?.[0]?.price?.id || null,
                  status: (fullSubscription?.status || subscription?.status) === 'active' ? 'active' : 'trialing',
                  current_period_start: fullSubscription?.current_period_start
                    ? new Date(fullSubscription.current_period_start * 1000).toISOString()
                    : subscription?.current_period_start
                      ? new Date(subscription.current_period_start * 1000).toISOString()
                      : new Date().toISOString(),
                  current_period_end: fullSubscription?.current_period_end
                    ? new Date(fullSubscription.current_period_end * 1000).toISOString()
                    : subscription?.current_period_end
                      ? new Date(subscription.current_period_end * 1000).toISOString()
                      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                };

                const subCreateResponse = await fetch('/api/organization/subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(subscriptionData),
                });

                if (!subCreateResponse.ok) {
                  const errorData = await subCreateResponse.json();
                  // If subscription already exists, that's okay (webhook created it)
                  if (!errorData.error?.includes('already has')) {
                    console.warn('[SignupCallback] Failed to create subscription:', errorData);
                  }
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
                if (statusError.skipped) {
                  console.log('[SignupCallback] Organization status update skipped (already active)');
                } else {
                  console.warn('[SignupCallback] Failed to update organization status:', statusError);
                }
              }
            }
          }
        } catch (subError) {
          console.warn('[SignupCallback] Failed to create subscription record:', subError);
          // Non-critical, continue - webhook will handle it
        }

        // Step 6: Clean up and redirect
        sessionStorage.removeItem('signup_data');
        sessionStorage.removeItem('selectedPackageId');
        router.push('/dashboard');
      } catch (err) {
        console.error('[SignupCallback] Error:', err);
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

