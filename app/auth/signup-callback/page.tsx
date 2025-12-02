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

        // Check if email confirmation is needed (but continue with subscription creation)
        const needsEmailConfirmation = !session;

        // Step 4: Create subscription FIRST (user has already paid!)
        // This must happen even if email confirmation is needed
        logger.info('[SignupCallback] Creating subscription (payment already completed):', {
          sessionId,
          organizationId: orgData.id,
          packageId,
          needsEmailConfirmation,
        });

        // Get Stripe subscription and customer from checkout session
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

        // Update organization with Stripe customer ID (with retry logic)
        let customerIdUpdated = false;
        const maxCustomerRetries = 3;
        
        for (let attempt = 0; attempt < maxCustomerRetries; attempt++) {
          try {
            if (attempt > 0) {
              const delay = 500 * Math.pow(2, attempt - 1);
              logger.info('[SignupCallback] Retrying customer ID update (attempt ' + (attempt + 1) + '):', {
                delay,
                organizationId: orgData.id,
                customerId: customer_id,
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            const customerUpdateResponse = await fetch('/api/organization/update-stripe-customer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organization_id: orgData.id,
                stripe_customer_id: customer_id,
              }),
            });
            
            if (customerUpdateResponse.ok) {
              customerIdUpdated = true;
              logger.info('[SignupCallback] Successfully updated customer ID:', {
                organizationId: orgData.id,
                customerId: customer_id,
                attempt: attempt + 1,
              });
              break;
            } else {
              const errorData = await customerUpdateResponse.json().catch(() => ({ error: 'Unknown error' }));
              logger.warn('[SignupCallback] Customer ID update attempt ' + (attempt + 1) + ' failed:', {
                error: errorData.error,
                organizationId: orgData.id,
                customerId: customer_id,
                attempt: attempt + 1,
              });
              
              if (attempt === maxCustomerRetries - 1) {
                logger.warn('[SignupCallback] Failed to update customer ID after all retries (webhook will handle):', {
                  organizationId: orgData.id,
                  customerId: customer_id,
                });
              }
            }
          } catch (err) {
            logger.error('[SignupCallback] Error updating customer ID (attempt ' + (attempt + 1) + '):', {
              error: err instanceof Error ? err.message : 'Unknown error',
              organizationId: orgData.id,
              customerId: customer_id,
            });
            
            if (attempt === maxCustomerRetries - 1) {
              logger.warn('[SignupCallback] Customer ID update failed after all retries, continuing (webhook will handle)');
            }
          }
        }

        // Create subscription record
        const fullSubscriptionResponse = await fetch(`/api/stripe/get-subscription?subscription_id=${subscription_id}`);
        let fullSubscription = null;
        if (fullSubscriptionResponse.ok) {
          fullSubscription = await fullSubscriptionResponse.json();
        } else {
          logger.warn('[SignupCallback] Failed to fetch full subscription details, using checkout session data');
        }

        if (!packageId) {
          logger.error('[SignupCallback] Missing packageId in signup data, cannot create subscription');
          throw new Error('Package ID is missing. Please try signing up again.');
        }
        
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
        
        let periodStart: string;
        let periodEnd: string;
        
        if (fullSubscription?.current_period_start && typeof fullSubscription.current_period_start === 'number' && fullSubscription.current_period_start > 0) {
          periodStart = new Date(fullSubscription.current_period_start * 1000).toISOString();
        } else if (subscription?.current_period_start && typeof subscription.current_period_start === 'number' && subscription.current_period_start > 0) {
          periodStart = new Date(subscription.current_period_start * 1000).toISOString();
        } else {
          periodStart = new Date().toISOString();
          logger.warn('[SignupCallback] Using fallback for current_period_start - Stripe did not provide valid date');
        }
        
        if (fullSubscription?.current_period_end && typeof fullSubscription.current_period_end === 'number' && fullSubscription.current_period_end > 0) {
          periodEnd = new Date(fullSubscription.current_period_end * 1000).toISOString();
        } else if (subscription?.current_period_end && typeof subscription.current_period_end === 'number' && subscription.current_period_end > 0) {
          periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } else {
          const startDate = new Date(periodStart);
          if (subscriptionBillingInterval === 'year') {
            startDate.setFullYear(startDate.getFullYear() + 1);
          } else {
            startDate.setMonth(startDate.getMonth() + 1);
          }
          periodEnd = startDate.toISOString();
          logger.warn('[SignupCallback] Using calculated fallback for current_period_end - Stripe did not provide valid date');
        }
        
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

        let subCreateResponse = await fetch('/api/organization/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionData),
        });

        if (!subCreateResponse.ok) {
          const errorData = await subCreateResponse.json();
          logger.warn('[SignupCallback] First subscription creation attempt failed, retrying:', {
            error: errorData.error,
            subscriptionId: subscription_id,
            organizationId: orgData.id,
          });
          
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
          
          if (errorData.error?.includes('already has')) {
            logger.info('[SignupCallback] Subscription may already exist, verifying...');
            const verifyResponse = await fetch(`/api/organization/subscription`);
            if (verifyResponse.ok) {
              const { subscription: existingSub } = await verifyResponse.json();
              if (existingSub && existingSub.stripe_subscription_id === subscription_id) {
                logger.info('[SignupCallback] Subscription verified, continuing signup');
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
        }

        // Update organization status to active
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
          if (!statusError.skipped) {
            logger.warn('[SignupCallback] Failed to update organization status:', {
              organizationId: orgData.id,
              error: statusError.error,
            });
          }
        }

        // If email confirmation is needed, show message and return early
        // User record will be created by trigger when they confirm email
        if (needsEmailConfirmation) {
          logger.info('[SignupCallback] Email confirmation needed, subscription created successfully:', {
            organizationId: orgData.id,
            subscriptionId: subscription_id,
            customerId: customer_id,
          });
          setNeedsEmailConfirmation(true);
          setLoading(false);
          // Keep signup_data in sessionStorage so they can complete after email confirmation
          return;
        }

        // Step 5: Create user record with retry logic (only if session exists)
        logger.info('[SignupCallback] Creating user record with organization:', {
          email,
          organizationId: orgData.id,
        });

        // Retry logic for user creation (handles race conditions with trigger)
        let createdUser = null;
        let userResponse = null;
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              // Exponential backoff: 500ms, 1000ms, 2000ms
              const delay = 500 * Math.pow(2, attempt - 1);
              logger.info('[SignupCallback] Retrying user creation (attempt ' + (attempt + 1) + '):', {
                delay,
                organizationId: orgData.id,
                email,
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            userResponse = await fetch('/api/auth/create-user-with-org', {
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
              lastError = errorData.error || 'Failed to create user record';
              logger.warn('[SignupCallback] User creation attempt ' + (attempt + 1) + ' failed:', {
                error: lastError,
                organizationId: orgData.id,
                email,
                attempt: attempt + 1,
                maxRetries,
              });
              
              // If it's the last attempt, throw error
              if (attempt === maxRetries - 1) {
                throw new Error(lastError);
              }
              continue; // Retry
            }

            // Verify user was assigned to correct organization
            const responseData = await userResponse.json();
            createdUser = responseData.user;
            
            if (!createdUser) {
              lastError = 'User creation returned no user data';
              logger.warn('[SignupCallback] User creation attempt ' + (attempt + 1) + ' returned no user data');
              
              if (attempt === maxRetries - 1) {
                throw new Error('User record creation failed. Please try signing in.');
              }
              continue; // Retry
            }

            // Verify organization assignment
            if (createdUser.organization_id !== orgData.id) {
              lastError = 'User was assigned to incorrect organization';
              logger.error('[SignupCallback] Organization assignment mismatch (attempt ' + (attempt + 1) + '):', {
                expectedOrgId: orgData.id,
                actualOrgId: createdUser.organization_id,
                userId: createdUser.id,
                email,
              });
              
              // If it's the last attempt, throw error
              if (attempt === maxRetries - 1) {
                throw new Error('User was assigned to incorrect organization. Please contact support.');
              }
              
              // Wait a bit longer before retrying organization assignment
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue; // Retry
            }

            // Success - break out of retry loop
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : 'Unknown error';
            logger.error('[SignupCallback] Error in user creation attempt ' + (attempt + 1) + ':', {
              error: lastError,
              organizationId: orgData.id,
              email,
            });
            
            if (attempt === maxRetries - 1) {
              throw err;
            }
          }
        }

        // Final verification
        if (!createdUser || createdUser.organization_id !== orgData.id) {
          logger.error('[SignupCallback] Failed to create/assign user after all retries:', {
            hasUser: !!createdUser,
            expectedOrgId: orgData.id,
            actualOrgId: createdUser?.organization_id,
            email,
          });
          throw new Error('Failed to assign user to organization after multiple attempts. Please contact support.');
        }

        logger.info('[SignupCallback] User successfully created and assigned to organization:', {
          userId: createdUser.id,
          email: createdUser.email,
          organizationId: createdUser.organization_id,
          role: createdUser.role,
        });

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

