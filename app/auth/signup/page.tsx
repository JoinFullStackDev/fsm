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
  Card,
  CardContent,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  alpha,
  useTheme,
  useMediaQuery,
  Chip,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Star as StarIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { PackageFeatures } from '@/lib/organizationContext';

interface Package {
  id: string;
  name: string;
  stripe_price_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  pricing_model: 'per_user' | 'flat_rate';
  base_price_monthly: number | null;
  base_price_yearly: number | null;
  price_per_user_monthly: number | null;
  price_per_user_yearly: number | null;
  features: PackageFeatures;
  is_active: boolean;
  display_order: number;
}

function SignUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const supabase = createSupabaseClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<'month' | 'year'>('month');
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [accountCreated, setAccountCreated] = useState(false);

  const loadPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      const response = await fetch('/api/packages', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (response.ok) {
        const data = await response.json();
        const loadedPackages = data.packages || [];
        setPackages(loadedPackages);
        
        const packageId = searchParams.get('package') || sessionStorage.getItem('selectedPackageId');
        if (packageId) {
          const pkg = loadedPackages.find((p: Package) => p.id === packageId);
          if (pkg) setSelectedPackage(pkg);
        }
      }
    } catch (err) {
      // Failed to load packages
    } finally {
      setLoadingPackages(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

    try {
      const signupData = {
        email,
        password,
        name: name || '',
        organizationName: organizationName.trim(),
        packageId: selectedPackage.id,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));

      const pricingModel = selectedPackage.pricing_model || 'per_user';
      const monthlyPrice = pricingModel === 'per_user' 
        ? selectedPackage.price_per_user_monthly 
        : selectedPackage.base_price_monthly;
      const yearlyPrice = pricingModel === 'per_user' 
        ? selectedPackage.price_per_user_yearly 
        : selectedPackage.base_price_yearly;
      const selectedPrice = selectedBillingInterval === 'month' ? monthlyPrice : yearlyPrice;
      const isFree = !selectedPrice || selectedPrice === 0;
      
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
            console.error('[Signup] Error creating subscription:', subError);
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

      // For paid packages
      const selectedPriceId = selectedBillingInterval === 'month' 
        ? selectedPackage.stripe_price_id_monthly 
        : selectedPackage.stripe_price_id_yearly;
      const hasValidStripePrice = selectedPriceId && selectedPriceId.startsWith('price_');
      const hasPrice = selectedPrice && selectedPrice > 0;
      
      if (!hasValidStripePrice && hasPrice) {
        sessionStorage.removeItem('signup_data');
        setError('This package is not configured for payment. Please contact support.');
        setLoading(false);
        return;
      }

      if (isFree || !hasValidStripePrice) {
        // Handle as free package (same logic as above)
        const orgSlug = organizationName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const orgResponse = await fetch('/api/auth/create-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: organizationName.trim(), slug: orgSlug }),
        });

        if (!orgResponse.ok) {
          const errorData = await orgResponse.json();
          sessionStorage.removeItem('signup_data');
          setError(errorData.message || 'Failed to create organization');
          setLoading(false);
          return;
        }

        const { organization: orgData } = await orgResponse.json();

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, role: 'admin', organization_id: orgData.id },
          },
        });

        if (signUpError) {
          sessionStorage.removeItem('signup_data');
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        if (authData.user && authData.session) {
          await fetch('/api/auth/create-user-with-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, role: 'admin', organization_id: orgData.id }),
          });

          try {
            await fetch('/api/organization/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organization_id: orgData.id, package_id: selectedPackage.id }),
            });
          } catch (subError) {
            console.error('[Signup] Error creating subscription:', subError);
          }

          sessionStorage.removeItem('signup_data');
          sessionStorage.removeItem('selectedPackageId');
          setAccountCreated(true);
          setTimeout(() => router.push('/dashboard'), 2000);
          return;
        }
      }

      // Redirect to Stripe checkout
      const successUrl = `${window.location.origin}/auth/signup-callback?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/auth/signup?canceled=true`;

      const checkoutResponse = await fetch('/api/stripe/create-signup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackage.id,
          billing_interval: selectedBillingInterval,
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
        window.location.href = checkoutUrl;
        return;
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

  const getFeatureList = (features: PackageFeatures) => {
    const list: { label: string; enabled: boolean }[] = [];
    
    list.push({ label: 'AI Features', enabled: !!features.ai_features_enabled });
    list.push({ label: 'Analytics Dashboard', enabled: !!features.analytics_enabled });
    list.push({ label: 'API Access', enabled: !!features.api_access_enabled });
    list.push({ label: 'Ops Tool', enabled: !!features.ops_tool_enabled });
    list.push({ label: 'Export Features', enabled: !!features.export_features_enabled });
    
    if (features.max_projects !== null) {
      list.push({ label: `${features.max_projects} Projects`, enabled: true });
    } else {
      list.push({ label: 'Unlimited Projects', enabled: true });
    }
    if (features.max_users !== null) {
      list.push({ label: `${features.max_users} Users`, enabled: true });
    } else {
      list.push({ label: 'Unlimited Users', enabled: true });
    }
    if (features.max_templates !== null) {
      list.push({ label: `${features.max_templates} Templates`, enabled: true });
    } else {
      list.push({ label: 'Unlimited Templates', enabled: true });
    }
    
    const supportLevel = features.support_level 
      ? features.support_level.charAt(0).toUpperCase() + features.support_level.slice(1)
      : 'Community';
    list.push({ label: `${supportLevel} Support`, enabled: true });
    
    return list;
  };

  const getPackagePrice = (pkg: Package) => {
    const pricingModel = pkg.pricing_model || 'per_user';
    const monthlyPrice = pricingModel === 'per_user' 
      ? pkg.price_per_user_monthly 
      : pkg.base_price_monthly;
    const yearlyPrice = pricingModel === 'per_user' 
      ? pkg.price_per_user_yearly 
      : pkg.base_price_yearly;
    const displayPrice = selectedBillingInterval === 'month' 
      ? (monthlyPrice || yearlyPrice || 0)
      : (yearlyPrice || monthlyPrice || 0);
    const suffix = pricingModel === 'per_user'
      ? (selectedBillingInterval === 'month' ? '/user/mo' : '/user/yr')
      : (selectedBillingInterval === 'month' ? '/mo' : '/yr');
    
    return { price: displayPrice, suffix, monthlyPrice, yearlyPrice, pricingModel };
  };

  // Selected package card component for right side
  const SelectedPackageCard = () => {
    if (!selectedPackage) {
      return (
        <Card
          sx={{
            height: '100%',
            minHeight: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.6)} 0%, ${alpha(theme.palette.background.paper, 0.3)} 100%)`,
            backdropFilter: 'blur(20px)',
            border: `2px dashed ${alpha(theme.palette.divider, 0.3)}`,
            borderRadius: 3,
          }}
        >
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <StarIcon sx={{ fontSize: 64, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Select a plan to see details
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
              Choose a plan from the left to view its features
            </Typography>
          </Box>
        </Card>
      );
    }

    const { price, suffix, monthlyPrice, yearlyPrice, pricingModel } = getPackagePrice(selectedPackage);
    const features = getFeatureList(selectedPackage.features);
    const isFree = price === 0;

    return (
      <motion.div
        key={selectedPackage.id}
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          sx={{
            height: '100%',
            background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
            backdropFilter: 'blur(20px)',
            border: `2px solid ${theme.palette.primary.main}`,
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              p: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a1a' }}>
                {selectedPackage.name}
              </Typography>
              <VerifiedIcon sx={{ fontSize: 28, color: '#1a1a1a' }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 800, color: '#1a1a1a' }}>
                {isFree ? 'Free' : `$${price.toFixed(2)}`}
              </Typography>
              {!isFree && (
                <Typography variant="body1" sx={{ color: '#1a1a1a' }}>
                  {suffix}
                </Typography>
              )}
            </Box>
            {monthlyPrice && yearlyPrice && !isFree && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#1a1a1a !important', 
                  mt: 0.5,
                }}
              >
                or ${(selectedBillingInterval === 'month' ? yearlyPrice : monthlyPrice).toFixed(2)}
                {pricingModel === 'per_user' ? '/user/' : '/'}
                {selectedBillingInterval === 'month' ? 'yr' : 'mo'}
              </Typography>
            )}
          </Box>

          {/* Features List */}
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
              What&apos;s Included
            </Typography>
            <Stack spacing={1.5}>
              {features.map((feature, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  {feature.enabled ? (
                    <CheckCircleIcon
                      sx={{
                        fontSize: 20,
                        color: theme.palette.success.main,
                      }}
                    />
                  ) : (
                    <CancelIcon
                      sx={{
                        fontSize: 20,
                        color: '#d4a017',
                      }}
                    />
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: feature.enabled ? 'text.primary' : '#d4a017',
                      textDecoration: feature.enabled ? 'none' : 'line-through',
                    }}
                  >
                    {feature.label}
                  </Typography>
                </Box>
              ))}
            </Stack>

            {/* Billing Toggle */}
            {monthlyPrice && yearlyPrice && (
              <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.secondary' }}>
                  Billing Cycle
                </Typography>
                <FormControl component="fieldset" fullWidth>
                  <RadioGroup
                    row
                    value={selectedBillingInterval}
                    onChange={(e) => setSelectedBillingInterval(e.target.value as 'month' | 'year')}
                    sx={{ justifyContent: 'center', gap: 2 }}
                  >
                    <FormControlLabel
                      value="month"
                      control={<Radio size="small" />}
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Monthly
                        </Typography>
                      }
                      sx={{
                        m: 0,
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        border: `1px solid ${selectedBillingInterval === 'month' ? theme.palette.primary.main : theme.palette.divider}`,
                        backgroundColor: selectedBillingInterval === 'month' ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                      }}
                    />
                    <FormControlLabel
                      value="year"
                      control={<Radio size="small" />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Yearly
                          </Typography>
                          <Chip label="Save 20%" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                        </Box>
                      }
                      sx={{
                        m: 0,
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        border: `1px solid ${selectedBillingInterval === 'year' ? theme.palette.primary.main : theme.palette.divider}`,
                        backgroundColor: selectedBillingInterval === 'year' ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                      }}
                    />
                  </RadioGroup>
                </FormControl>
              </Box>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at top left, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 50%),
                     radial-gradient(ellipse at bottom right, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 50%),
                     ${theme.palette.background.default}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Back Button */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/')}
          sx={{
            color: 'text.primary',
            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
          }}
        >
          Back
        </Button>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: '100vh',
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 10, md: 4 },
          gap: { xs: 3, md: 4 },
        }}
      >
        {/* Left Side - Compact Form */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '0 0 480px' },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mb: 0.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Get Started
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Create your account and choose a plan
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {accountCreated && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Account created! Redirecting to dashboard...
              </Alert>
            )}

            <Box component="form" onSubmit={handleSignUp}>
              {/* Plan Selection - Compact Cards */}
              {!loadingPackages && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.secondary' }}>
                    Select Plan
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 1.5,
                    }}
                  >
                    {packages.map((pkg) => {
                      const { price, suffix } = getPackagePrice(pkg);
                      const isSelected = selectedPackage?.id === pkg.id;
                      const isFree = price === 0;

                      return (
                        <motion.div
                          key={pkg.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Card
                            onClick={() => setSelectedPackage(pkg)}
                            sx={{
                              cursor: 'pointer',
                              border: isSelected
                                ? `2px solid ${theme.palette.primary.main}`
                                : `1px solid ${theme.palette.divider}`,
                              backgroundColor: isSelected
                                ? alpha(theme.palette.primary.main, 0.05)
                                : 'background.paper',
                              transition: 'all 0.2s',
                              position: 'relative',
                              '&:hover': {
                                borderColor: theme.palette.primary.main,
                                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                              },
                            }}
                          >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              {isSelected && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    backgroundColor: theme.palette.primary.main,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <CheckCircleIcon sx={{ fontSize: 14, color: 'white' }} />
                                </Box>
                              )}
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600, mb: 0.5, pr: isSelected ? 3 : 0 }}
                              >
                                {pkg.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                <Typography
                                  variant="h6"
                                  sx={{ fontWeight: 700, color: theme.palette.primary.main }}
                                >
                                  {isFree ? 'Free' : `$${price.toFixed(0)}`}
                                </Typography>
                                {!isFree && (
                                  <Typography variant="caption" color="text.secondary">
                                    {suffix}
                                  </Typography>
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {loadingPackages && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {/* Form Fields - Compact */}
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Organization Name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                  size="small"
                  disabled={loading || accountCreated}
                  sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'background.paper' } }}
                />
                <TextField
                  fullWidth
                  label="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  size="small"
                  autoComplete="name"
                  disabled={loading || accountCreated}
                  sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'background.paper' } }}
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  size="small"
                  autoComplete="email"
                  disabled={loading || accountCreated}
                  sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'background.paper' } }}
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  size="small"
                  autoComplete="new-password"
                  helperText="At least 6 characters"
                  disabled={loading || accountCreated}
                  sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'background.paper' } }}
                />
              </Stack>

              {!accountCreated && (
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || !selectedPackage}
                  endIcon={loading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <ArrowForwardIcon />}
                  sx={{
                    mt: 3,
                    py: 1.5,
                    fontWeight: 600,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                    color: '#1a1a1a',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                      background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                    },
                    '&:disabled': {
                      background: theme.palette.action.disabledBackground,
                      color: theme.palette.action.disabled,
                    },
                  }}
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </Button>
              )}

              <Typography variant="body2" align="center" sx={{ color: 'text.secondary', mt: 2 }}>
                Already have an account?{' '}
                <Link href="/auth/signin" underline="hover" sx={{ fontWeight: 600 }}>
                  Sign in
                </Link>
              </Typography>
            </Box>
          </motion.div>
        </Box>

        {/* Right Side - Selected Package Details */}
        {/* On mobile, only show when a package is selected */}
        {(!isMobile || selectedPackage) && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 'auto', md: '100vh' },
              py: { xs: 2, md: 0 },
            }}
          >
            <Box sx={{ width: '100%', maxWidth: { xs: '100%', md: 420 } }}>
              <AnimatePresence mode="wait">
                <SelectedPackageCard />
              </AnimatePresence>
            </Box>
          </Box>
        )}
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
