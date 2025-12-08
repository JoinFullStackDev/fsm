'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Divider,
  alpha,
  useTheme,
  Paper,
  IconButton,
} from '@mui/material';
import { 
  CreditCard as CreditCardIcon,
  Close as CloseIcon,
  Rocket as RocketIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { Package } from '@/lib/organizationContext';

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
  package: Package | null;
  affiliateCode?: string | null;
}

export default function SignupModal({ open, onClose, package: selectedPackage, affiliateCode }: SignupModalProps) {
  const router = useRouter();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<'month' | 'year'>('month');
  const [userQuantity, setUserQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!selectedPackage) return null;

  const pricingModel = selectedPackage.pricing_model || 'per_user';
  const monthlyPrice = pricingModel === 'per_user' 
    ? selectedPackage.price_per_user_monthly 
    : selectedPackage.base_price_monthly;
  const yearlyPrice = pricingModel === 'per_user' 
    ? selectedPackage.price_per_user_yearly 
    : selectedPackage.base_price_yearly;
  const selectedPrice = selectedBillingInterval === 'month' ? monthlyPrice : yearlyPrice;
  const hasMonthly = monthlyPrice !== null && monthlyPrice !== undefined && monthlyPrice > 0;
  const hasYearly = yearlyPrice !== null && yearlyPrice !== undefined && yearlyPrice > 0;
  const isFree = !selectedPrice || selectedPrice === 0;
  
  // Calculate total price based on quantity (only for per-user plans)
  const totalPrice = pricingModel === 'per_user' && selectedPrice
    ? (selectedPrice * userQuantity)
    : selectedPrice;
  
  // Get max users from package features
  const maxUsers = selectedPackage.features?.max_users;
  // Show quantity selector for all per-user plans (unlimited if maxUsers is null)
  const canSelectQuantity = pricingModel === 'per_user';

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate
    if (!organizationName || organizationName.trim().length === 0) {
      setError('Organization name is required');
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }

    try {
      // Store signup data in sessionStorage for use after payment
      const signupData = {
        email,
        password,
        name: name || '',
        organizationName: organizationName.trim(),
        packageId: selectedPackage.id,
        billingInterval: selectedBillingInterval,
        userQuantity: pricingModel === 'per_user' ? userQuantity : 1,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));

      // For free packages, create account immediately
      if (isFree) {
        const orgSlug = organizationName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const orgResponse = await fetch('/api/auth/create-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: organizationName.trim(),
            slug: orgSlug,
          }),
        });

        if (!orgResponse.ok) {
          const errorData = await orgResponse.json();
          sessionStorage.removeItem('signup_data');
          setError(errorData.message || 'Failed to create organization');
          setLoading(false);
          return;
        }

        const { organization: orgData } = await orgResponse.json();

        // Sign up user
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
          sessionStorage.removeItem('signup_data');
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        if (authData.user && authData.session) {
          // Create user record
          const userRecordResponse = await fetch('/api/auth/create-user-with-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              name,
              role: 'admin',
              organization_id: orgData.id,
            }),
          });
          
          if (!userRecordResponse.ok) {
            const userErrorData = await userRecordResponse.json().catch(() => ({ error: 'Failed to create user record' }));
            sessionStorage.removeItem('signup_data');
            setError(userErrorData.error || 'Failed to create user record. Please try signing in.');
            setLoading(false);
            return;
          }

          // Create subscription for free package
          try {
            const subResponse = await fetch('/api/organization/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organization_id: orgData.id,
                package_id: selectedPackage.id,
                billing_interval: selectedBillingInterval,
              }),
            });
            
            if (!subResponse.ok) {
              const subErrorData = await subResponse.json().catch(() => ({ error: 'Unknown error' }));
              console.error('[SignupModal] Failed to create subscription for free package:', {
                organizationId: orgData.id,
                packageId: selectedPackage.id,
                error: subErrorData.error,
              });
              // Continue signup even if subscription creation fails for free packages
              // User can still access the system, subscription can be created later
            }
          } catch (subError) {
            console.error('[SignupModal] Error creating subscription for free package:', {
              organizationId: orgData.id,
              packageId: selectedPackage.id,
              error: subError instanceof Error ? subError.message : 'Unknown error',
            });
            // Continue signup even if subscription creation fails for free packages
          }

          sessionStorage.removeItem('signup_data');
          onClose();
          router.push('/dashboard');
          return;
        }
      }

      // For paid packages, redirect to Stripe checkout
      const selectedPriceId = selectedBillingInterval === 'month' 
        ? selectedPackage.stripe_price_id_monthly 
        : selectedPackage.stripe_price_id_yearly;
      const hasValidStripePrice = selectedPriceId && selectedPriceId.startsWith('price_');

      if (!hasValidStripePrice && !isFree) {
        sessionStorage.removeItem('signup_data');
        setError('This package is not configured for payment. Please contact support or select a different package.');
        setLoading(false);
        return;
      }

      // Create organization first (before checkout)
      const orgSlug = organizationName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const orgResponse = await fetch('/api/auth/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: organizationName.trim(),
          slug: orgSlug,
        }),
      });

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json();
        sessionStorage.removeItem('signup_data');
        setError(errorData.message || 'Failed to create organization');
        setLoading(false);
        return;
      }

      const { organization: orgData } = await orgResponse.json();
      setOrganizationName(orgData.name);

      // Build success and cancel URLs
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/auth/signup-callback?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/auth/signup?canceled=true`;

      // Get affiliate code from prop or sessionStorage
      const effectiveAffiliateCode = affiliateCode || sessionStorage.getItem('affiliate_code');

      // Redirect to Stripe checkout
      const checkoutResponse = await fetch('/api/stripe/create-signup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgData.id,
          package_id: selectedPackage.id,
          billing_interval: selectedBillingInterval,
          quantity: pricingModel === 'per_user' ? userQuantity : 1,
          email,
          name: name || '',
          organization_name: organizationName.trim(),
          success_url: successUrl,
          cancel_url: cancelUrl,
          affiliate_code: effectiveAffiliateCode,
        }),
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json();
        sessionStorage.removeItem('signup_data');
        setError(errorData.error || 'Failed to create checkout session');
        setLoading(false);
        return;
      }

      const { url } = await checkoutResponse.json();
      if (url) {
        window.location.href = url;
      } else {
        setError('Failed to create checkout session');
        setLoading(false);
      }
    } catch (err) {
      sessionStorage.removeItem('signup_data');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const formatPrice = (price: number | null, interval: 'month' | 'year') => {
    if (!price || price === 0) return 'Free';
    const suffix = pricingModel === 'per_user'
      ? (interval === 'month' ? '/user/mo' : '/user/yr')
      : (interval === 'month' ? '/mo' : '/yr');
    return `$${price.toFixed(2)}${suffix}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          boxShadow: `0 16px 64px ${alpha(theme.palette.primary.main, 0.2)}`,
          backdropFilter: 'blur(10px)',
        },
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <form onSubmit={handleSignUp}>
              <DialogTitle
                sx={{
                  position: 'relative',
                  pb: 2,
                  pt: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  zIndex: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                        border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      }}
                    >
                      <RocketIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
                    </Box>
                  </motion.div>
                  <Box sx={{ flex: 1 }}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    >
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontWeight: 800,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        Create Your Account
                      </Typography>
                    </motion.div>
                  </Box>
                  <IconButton
                    onClick={onClose}
                    disabled={loading}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.error.main, 0.1),
                        color: theme.palette.error.main,
                      },
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Selected Plan: <strong style={{ color: theme.palette.primary.main }}>{selectedPackage.name}</strong>
                  </Typography>
                </motion.div>
              </DialogTitle>
              <DialogContent 
                sx={{ 
                  pt: '32px !important',
                  pb: 2,
                  px: 3,
                  position: 'relative',
                  zIndex: 0,
                  overflowY: 'auto',
                  maxHeight: 'calc(100vh - 200px)',
                }}
              >
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.15)}`,
                  }} 
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Billing Interval Selector */}
          {hasMonthly && hasYearly && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{ marginTop: '8px' }}
            >
              <FormControl fullWidth sx={{ mb: 3, mt: 0 }}>
                <InputLabel>Billing Interval</InputLabel>
                <Select
                  value={selectedBillingInterval}
                  onChange={(e) => setSelectedBillingInterval(e.target.value as 'month' | 'year')}
                  label="Billing Interval"
                  sx={{
                    borderRadius: 2,
                    '&:hover': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                  }}
                >
                  <MenuItem value="month">Monthly - {formatPrice(monthlyPrice, 'month')}</MenuItem>
                  <MenuItem value="year">Yearly - {formatPrice(yearlyPrice, 'year')}</MenuItem>
                </Select>
              </FormControl>
            </motion.div>
          )}

          {/* User Quantity Selector (for per-user plans) */}
          {canSelectQuantity && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <TextField
                fullWidth
                type="number"
                label="Number of Users"
                value={userQuantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value >= 1) {
                    // If maxUsers is null (unlimited), allow any number >= 1
                    // If maxUsers has a value, limit to that value
                    if (maxUsers === null) {
                      setUserQuantity(value);
                    } else {
                      setUserQuantity(Math.min(value, maxUsers));
                    }
                  } else if (e.target.value === '') {
                    setUserQuantity(1);
                  }
                }}
                inputProps={{
                  min: 1,
                  max: maxUsers === null ? undefined : maxUsers,
                }}
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                  },
                }}
                helperText={
                  maxUsers === null 
                    ? 'Unlimited users available on this plan'
                    : `Maximum ${maxUsers} users allowed on this plan`
                }
              />
            </motion.div>
          )}

          {/* Price Summary */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'all 0.3s ease',
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                Selected Plan
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {selectedPackage.name}
              </Typography>
              {pricingModel === 'per_user' && userQuantity > 1 ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {formatPrice(selectedPrice, selectedBillingInterval)} × {userQuantity} users
                  </Typography>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    ${totalPrice?.toFixed(2) || '0.00'}{selectedBillingInterval === 'month' ? '/mo' : '/yr'}
                  </Typography>
                </Box>
              ) : (
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 800,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {formatPrice(totalPrice, selectedBillingInterval)}
                </Typography>
              )}
            </Paper>
          </motion.div>

          <Divider sx={{ my: 3, borderColor: alpha(theme.palette.divider, 0.5) }} />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <TextField
              fullWidth
              label="Organization Name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                },
              }}
              disabled={loading}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <TextField
              fullWidth
              label="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                },
              }}
              disabled={loading}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                },
              }}
              disabled={loading}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                },
              }}
              disabled={loading}
              helperText="Must be at least 6 characters"
            />
          </motion.div>
              </DialogContent>
              <DialogActions 
                sx={{ 
                  p: 3,
                  pt: 2,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.5)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
                }}
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    onClick={onClose} 
                    disabled={loading}
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.45 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} sx={{ color: theme.palette.getContrastText(theme.palette.primary.main) }} /> : <CreditCardIcon sx={{ color: theme.palette.getContrastText(theme.palette.primary.main) }} />}
                    disabled={loading}
                    sx={{
                      borderRadius: 2,
                      px: 4,
                      py: 1.2,
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#000000 !important',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%) !important`,
                      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                      '& .MuiButton-startIcon': {
                        color: theme.palette.getContrastText(theme.palette.primary.main) + ' !important',
                      },
                      '& .MuiCircularProgress-root': {
                        color: theme.palette.getContrastText(theme.palette.primary.main) + ' !important',
                      },
                      '&:hover': {
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%) !important`,
                        color: theme.palette.getContrastText(theme.palette.primary.dark) + ' !important',
                        '& .MuiButton-startIcon': {
                          color: theme.palette.getContrastText(theme.palette.primary.dark) + ' !important',
                        },
                      },
                      '&:disabled': {
                        color: theme.palette.getContrastText(theme.palette.primary.main) + ' !important',
                        opacity: 0.7,
                        '& .MuiButton-startIcon': {
                          color: theme.palette.getContrastText(theme.palette.primary.main) + ' !important',
                        },
                      },
                    }}
                  >
                    {isFree ? 'Create Account' : 'Continue to Payment'}
                  </Button>
                </motion.div>
              </DialogActions>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

