'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Divider,
  alpha,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Rocket as RocketIcon,
  AutoAwesome as AIIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  ArrowForward as ArrowForwardIcon,
  CreditCard as CreditCardIcon,
  ArrowBackIos as ArrowBackIosIcon,
  ArrowForwardIos as ArrowForwardIosIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { PackageFeatures } from '@/lib/organizationContext';

interface Package {
  id: string;
  name: string;
  stripe_price_id: string | null;
  price_per_user_monthly: number;
  features: PackageFeatures;
  is_active: boolean;
  display_order: number;
}

const platformFeatures = [
  {
    icon: <RocketIcon sx={{ fontSize: 48 }} />,
    title: 'Guided Process',
    description: 'Step-by-step guidance through all 6 phases of product development',
    color: '#00E5FF',
  },
  {
    icon: <AIIcon sx={{ fontSize: 48 }} />,
    title: 'AI-Powered',
    description: 'Generate PRDs, ERDs, and user stories in minutes with AI assistance',
    color: '#E91E63',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 48 }} />,
    title: 'Enterprise Ready',
    description: 'Multi-tenant architecture with RBAC, audit trails, and team collaboration',
    color: '#00E5FF',
  },
  {
    icon: <AnalyticsIcon sx={{ fontSize: 48 }} />,
    title: 'Reporting & Insights',
    description: 'See progress, risks, and blockers at a glance with real-time analytics',
    color: '#E91E63',
  },
];

function SignUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [packageSliderIndex, setPackageSliderIndex] = useState(0);

  const loadPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      const response = await fetch('/api/packages', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const loadedPackages = data.packages || [];
        console.log('[SignupPage] Loaded packages:', loadedPackages.length, 'packages');
        console.log('[SignupPage] Package names:', loadedPackages.map((p: Package) => p.name).join(', '));
        if (loadedPackages.length > 0) {
          console.log('[SignupPage] First package details:', {
            name: loadedPackages[0].name,
            price: loadedPackages[0].price_per_user_monthly,
            features: loadedPackages[0].features,
          });
        }
        setPackages(loadedPackages);
        
        // Check if package was pre-selected
        const packageId = searchParams.get('package') || sessionStorage.getItem('selectedPackageId');
        if (packageId) {
          const pkg = loadedPackages.find((p: Package) => p.id === packageId);
          if (pkg) {
            setSelectedPackage(pkg);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoadingPackages(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    // Auto-rotate features
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % platformFeatures.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

    if (!selectedPackage) {
      setError('Please select a package');
      setLoading(false);
      return;
    }

    console.log('[SignupPage] Starting signup with package:', {
      id: selectedPackage.id,
      name: selectedPackage.name,
      price: selectedPackage.price_per_user_monthly,
    });

    try {
      // Store signup data in sessionStorage for use after payment
      const signupData = {
        email,
        password,
        name: name || '',
        organizationName: organizationName.trim(),
        packageId: selectedPackage.id,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));

      // For free packages, create account immediately
      if (selectedPackage.price_per_user_monthly === 0) {
        // Create organization
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
          await fetch('/api/auth/create-user-with-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              name,
              role: 'admin',
              organization_id: orgData.id,
            }),
          });

          // Create subscription for free package
          try {
            await fetch('/api/organization/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organization_id: orgData.id,
                package_id: selectedPackage.id,
              }),
            });
          } catch (subError) {
            console.warn('Failed to create subscription:', subError);
          }

          sessionStorage.removeItem('signup_data');
          sessionStorage.removeItem('selectedPackageId');
          setAccountCreated(true);
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
          return;
        }
      }

      // For paid packages, redirect to Stripe checkout first
      // Check if package has a valid Stripe price ID
      const hasValidStripePrice = selectedPackage.stripe_price_id && 
        selectedPackage.stripe_price_id.startsWith('price_');

      if (!hasValidStripePrice && selectedPackage.price_per_user_monthly > 0) {
        sessionStorage.removeItem('signup_data');
        setError('This package is not configured for payment. Please contact support or select a different package.');
        setLoading(false);
        return;
      }

      // If package is free or has no valid Stripe price, treat as free package
      if (selectedPackage.price_per_user_monthly === 0 || !hasValidStripePrice) {
        // This should have been handled in the free package section above
        // But if we get here, create account immediately
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
          await fetch('/api/auth/create-user-with-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              name,
              role: 'admin',
              organization_id: orgData.id,
            }),
          });

          // Create subscription
          try {
            await fetch('/api/organization/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organization_id: orgData.id,
                package_id: selectedPackage.id,
              }),
            });
          } catch (subError) {
            console.warn('Failed to create subscription:', subError);
          }

          sessionStorage.removeItem('signup_data');
          sessionStorage.removeItem('selectedPackageId');
          setAccountCreated(true);
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
          return;
        }
      }

      // For paid packages with valid Stripe price, proceed to checkout
      const successUrl = `${window.location.origin}/auth/signup-callback?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/auth/signup?canceled=true`;

      const checkoutResponse = await fetch('/api/stripe/create-signup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackage.id,
          email,
          name: name || '',
          organization_name: organizationName.trim(),
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json();
        sessionStorage.removeItem('signup_data');
        setError(errorData.error || 'Failed to create checkout session');
        setLoading(false);
        return;
      }

      const { url: checkoutUrl } = await checkoutResponse.json();
      if (checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = checkoutUrl;
        return; // Don't set loading to false, we're redirecting
      } else {
        sessionStorage.removeItem('signup_data');
        setError('Failed to get checkout URL');
        setLoading(false);
      }
    } catch (err) {
      sessionStorage.removeItem('signup_data');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!organizationId || !selectedPackage) return;

    setLoading(true);
    try {
      // Ensure session is refreshed
      await supabase.auth.refreshSession();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create checkout session
      const checkoutResponse = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackage.id,
          success_url: `${window.location.origin}/dashboard?payment=success`,
          cancel_url: `${window.location.origin}/auth/signup?payment=cancelled`,
        }),
      });

      if (checkoutResponse.ok) {
        const { url } = await checkoutResponse.json();
        if (url) {
          window.location.href = url;
          return;
        }
      } else {
        const errorData = await checkoutResponse.json();
        setError(errorData.message || 'Failed to create checkout session');
      }
    } catch (checkoutError) {
      console.error('Checkout error:', checkoutError);
      setError('Failed to create checkout session');
    } finally {
      setLoading(false);
    }
  };

  const getFeatureList = (features: PackageFeatures) => {
    const list: string[] = [];
    
    // Module features
    if (features.ai_features_enabled) list.push('AI Features');
    if (features.analytics_enabled) list.push('Analytics');
    if (features.api_access_enabled) list.push('API Access');
    if (features.ops_tool_enabled) list.push('Ops Tool');
    if (features.export_features_enabled) list.push('Export Features');
    
    // Limits
    if (features.max_projects !== null) {
      list.push(`${features.max_projects} Projects`);
    } else {
      list.push('Unlimited Projects');
    }
    if (features.max_users !== null) {
      list.push(`${features.max_users} Users`);
    } else {
      list.push('Unlimited Users');
    }
    if (features.max_templates !== null) {
      list.push(`${features.max_templates} Templates`);
    } else {
      list.push('Unlimited Templates');
    }
    
    // Support level
    const supportLevel = features.support_level 
      ? features.support_level.charAt(0).toUpperCase() + features.support_level.slice(1)
      : 'Community';
    list.push(`${supportLevel} Support`);
    
    return list;
  };

  const currentFeature = platformFeatures[currentFeatureIndex];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at top, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 50%),
                     radial-gradient(ellipse at bottom, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 50%),
                     ${theme.palette.background.default}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Back to Home Button */}
      <Box
        sx={{
          position: 'absolute',
          top: 24,
          left: 24,
          zIndex: 10,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/')}
          sx={{
            color: 'text.primary',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            },
          }}
        >
          Back to Home
        </Button>
      </Box>
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
        }}
      >
        {/* Left Side - Form */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: { xs: 4, md: 8 },
            py: 6,
            maxWidth: '50%',
            backgroundColor: alpha(theme.palette.background.paper, 0.5),
            backdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                mb: 1,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Your Account
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              Join FullStack Method™ and start building better products
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <AnimatePresence mode="wait">
              {!showPayment ? (
                <motion.div
                  key="signup-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {accountCreated && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                      Account created successfully! Please complete payment to activate your subscription.
                    </Alert>
                  )}
                  <Box component="form" onSubmit={handleSignUp}>
                    {/* Package Selection */}
                    {!loadingPackages && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                          Select Your Plan
                        </Typography>
                        <Box sx={{ position: 'relative', width: '100%' }}>
                          {/* Slider Container */}
                          <Box
                            sx={{
                              display: 'flex',
                              overflow: 'hidden',
                              position: 'relative',
                              width: '100%',
                              py: 2,
                            }}
                          >
                            <motion.div
                              animate={{
                                x: packages.length > 4 
                                  ? `-${packageSliderIndex * 100}%` 
                                  : '0%',
                              }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              style={{
                                display: 'flex',
                                gap: '16px',
                                width: packages.length > 4 ? `${Math.ceil(packages.length / 4) * 100}%` : '100%',
                              }}
                            >
                              {packages.map((pkg) => (
                                <motion.div
                                  key={pkg.id}
                                  whileHover={{ scale: 1.02, y: -4 }}
                                  style={{
                                    flex: '0 0 calc(25% - 12px)',
                                    minWidth: 0,
                                  }}
                                >
                                  <Card
                                    onClick={() => {
                                      console.log('[SignupPage] Package selected:', pkg.name, pkg.id, pkg.price_per_user_monthly);
                                      setSelectedPackage(pkg);
                                    }}
                                    sx={{
                                      height: '100%',
                                      border: selectedPackage?.id === pkg.id
                                        ? `2px solid ${theme.palette.primary.main}`
                                        : `1px solid ${theme.palette.divider}`,
                                      backgroundColor: selectedPackage?.id === pkg.id
                                        ? alpha(theme.palette.primary.main, 0.05)
                                        : 'background.paper',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      position: 'relative',
                                      '&:hover': {
                                        borderColor: theme.palette.primary.main,
                                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                                      },
                                    }}
                                  >
                                    <CardContent sx={{ p: 2.5 }}>
                                      {selectedPackage?.id === pkg.id && (
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            top: 8,
                                            right: 8,
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            backgroundColor: '#4caf50',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          <CheckCircleIcon sx={{ fontSize: 16, color: 'white' }} />
                                        </Box>
                                      )}
                                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, pr: selectedPackage?.id === pkg.id ? 4 : 0 }}>
                                        {pkg.name}
                                      </Typography>
                                      <Box sx={{ mb: 2 }}>
                                        <Typography
                                          variant="h4"
                                          sx={{
                                            fontWeight: 800,
                                            display: 'inline',
                                            color: theme.palette.primary.main,
                                          }}
                                        >
                                          ${pkg.price_per_user_monthly.toFixed(2)}
                                        </Typography>
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          sx={{ display: 'inline', ml: 0.5 }}
                                        >
                                          /mo
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        {getFeatureList(pkg.features).slice(0, 3).map((feature, idx) => (
                                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                              {feature}
                                            </Typography>
                                          </Box>
                                        ))}
                                        {getFeatureList(pkg.features).length > 3 && (
                                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                            +{getFeatureList(pkg.features).length - 3} more
                                          </Typography>
                                        )}
                                      </Box>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              ))}
                            </motion.div>
                          </Box>

                          {/* Slider Navigation */}
                          {packages.length > 4 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                              <IconButton
                                onClick={() => setPackageSliderIndex(Math.max(0, packageSliderIndex - 1))}
                                disabled={packageSliderIndex === 0}
                                sx={{
                                  color: 'text.primary',
                                  '&:disabled': { opacity: 0.3 },
                                }}
                              >
                                <ArrowBackIosIcon />
                              </IconButton>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {Array.from({ length: Math.ceil(packages.length / 4) }).map((_, idx) => (
                                  <Box
                                    key={idx}
                                    onClick={() => setPackageSliderIndex(idx)}
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: packageSliderIndex === idx
                                        ? theme.palette.primary.main
                                        : theme.palette.divider,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                    }}
                                  />
                                ))}
                              </Box>
                              <IconButton
                                onClick={() => {
                                  const maxIndex = Math.ceil(packages.length / 4) - 1;
                                  setPackageSliderIndex(Math.min(maxIndex, packageSliderIndex + 1));
                                }}
                                disabled={packageSliderIndex >= Math.ceil(packages.length / 4) - 1}
                                sx={{
                                  color: 'text.primary',
                                  '&:disabled': { opacity: 0.3 },
                                }}
                              >
                                <ArrowForwardIosIcon />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}

                    {loadingPackages && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                      </Box>
                    )}

                    <TextField
                      fullWidth
                      label="Organization Name"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      required
                      margin="normal"
                      helperText="This will be your company or team name"
                      disabled={loading || accountCreated}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'background.paper',
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Your Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      margin="normal"
                      autoComplete="name"
                      disabled={loading || accountCreated}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'background.paper',
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      margin="normal"
                      autoComplete="email"
                      disabled={loading || accountCreated}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'background.paper',
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      margin="normal"
                      autoComplete="new-password"
                      helperText="Must be at least 6 characters"
                      disabled={loading || accountCreated}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'background.paper',
                        },
                      }}
                    />

                    {!accountCreated && (
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading || !selectedPackage}
                        endIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <ArrowForwardIcon />}
                        sx={{
                          mt: 3,
                          mb: 2,
                          py: 1.5,
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          borderRadius: 2,
                          backgroundColor: '#4caf50',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: '#45a049',
                            transform: 'translateY(-2px)',
                            boxShadow: `0 8px 24px ${alpha('#4caf50', 0.4)}`,
                          },
                          '&:disabled': {
                            backgroundColor: theme.palette.action.disabledBackground,
                            color: theme.palette.action.disabled,
                          },
                        }}
                      >
                        {loading ? 'Creating Account...' : 'Create Account'}
                      </Button>
                    )}

                    <Typography variant="body2" align="center" sx={{ color: 'text.secondary' }}>
                      Already have an account?{' '}
                      <Link href="/auth/signin" underline="hover" sx={{ fontWeight: 600 }}>
                        Sign in
                      </Link>
                    </Typography>
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  key="payment-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    sx={{
                      border: `2px solid ${theme.palette.primary.main}`,
                      backgroundColor: 'background.paper',
                      boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <CreditCardIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Complete Your Payment
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            You&apos;ll be redirected to our secure payment page
                          </Typography>
                        </Box>
                      </Box>

                      {selectedPackage && (
                        <Box sx={{ mb: 3, p: 2, backgroundColor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Selected Plan
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {selectedPackage.name}
                          </Typography>
                          <Typography variant="body1" color="primary.main" sx={{ fontWeight: 600 }}>
                            ${selectedPackage.price_per_user_monthly}/mo
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setShowPayment(false);
                            setAccountCreated(false);
                          }}
                          disabled={loading}
                          sx={{
                            flex: 1,
                            py: 1.5,
                            borderRadius: 2,
                          }}
                        >
                          Back
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
                          onClick={handlePayment}
                          disabled={loading}
                          endIcon={loading ? <CircularProgress size={20} /> : <ArrowForwardIcon />}
                          sx={{
                            flex: 2,
                            py: 1.5,
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            borderRadius: 2,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                            },
                          }}
                        >
                          {loading ? 'Processing...' : 'Continue to Payment'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </Box>

        {/* Right Side - Animated Features */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 4, md: 8 },
            py: 6,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFeatureIndex}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -30 }}
              transition={{ duration: 0.5 }}
              style={{ width: '100%', maxWidth: 500 }}
            >
              <Card
                sx={{
                  p: 4,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 3,
                  backdropFilter: 'blur(10px)',
                  boxShadow: `0 12px 48px ${alpha(theme.palette.common.black, 0.1)}`,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 3,
                    color: currentFeature.color,
                  }}
                >
                  {currentFeature.icon}
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    mb: 2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {currentFeature.title}
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {currentFeature.description}
                </Typography>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Feature Indicators */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
            }}
          >
            {platformFeatures.map((_, index) => (
              <motion.div
                key={index}
                animate={{
                  scale: currentFeatureIndex === index ? 1.2 : 1,
                  opacity: currentFeatureIndex === index ? 1 : 0.5,
                }}
                transition={{ duration: 0.3 }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: currentFeatureIndex === index
                      ? theme.palette.primary.main
                      : theme.palette.divider,
                    cursor: 'pointer',
                  }}
                  onClick={() => setCurrentFeatureIndex(index)}
                />
              </motion.div>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <SignUpPageContent />
    </Suspense>
  );
}
