'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  useTheme,
  alpha,
  Stepper,
  Step,
  StepLabel,
  Stack,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Link,
  InputAdornment,
  IconButton,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

const steps = ['Account', 'Personal Info', 'Audience', 'Promotion', 'Review'];

const promotionMethodOptions = [
  'Blog/Content Marketing',
  'YouTube/Video Content',
  'Social Media (Twitter, LinkedIn, etc.)',
  'Email Newsletter',
  'Podcast',
  'Online Courses/Training',
  'Community/Forum',
  'Paid Advertising',
  'Consulting/Agency',
  'Other',
];

function AffiliateApplyPageContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState('');
  
  // Inline auth state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authOrgName, setAuthOrgName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company_name: '',
    website: '',
    social_media_links: [''],
    audience_size: '',
    audience_description: '',
    promotion_methods: [] as string[],
    motivation: '',
  });

  // Check authentication status and handle return from Stripe
  useEffect(() => {
    const checkAuth = async () => {
      // Check if user canceled Stripe checkout
      if (searchParams.get('canceled') === 'true') {
        setAuthError('Checkout was canceled. Please try again.');
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email || '');
        setFormData(prev => ({
          ...prev,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || '',
        }));
        // Skip to step 1 if authenticated
        setActiveStep(1);
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, [supabase, searchParams]);

  // Handle inline authentication (sign in or sign up)
  const handleInlineAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'signup') {
        // Validate signup fields
        if (!authName.trim()) {
          throw new Error('Full name is required');
        }
        if (!authOrgName.trim()) {
          throw new Error('Organization name is required');
        }
        if (!authEmail.trim()) {
          throw new Error('Email is required');
        }
        if (!authPassword || authPassword.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        // Fetch Pro package (for affiliates)
        const pkgResponse = await fetch('/api/packages');
        const pkgData = await pkgResponse.json();
        
        // Find Pro or Entrepreneur package (prioritize exact match)
        const proPackage = pkgData.packages?.find((p: any) => 
          p.name.toLowerCase() === 'pro' || 
          p.name.toLowerCase() === 'entrepreneur'
        ) || pkgData.packages?.find((p: any) => 
          p.name.toLowerCase().includes('pro') || 
          p.name.toLowerCase().includes('entrepreneur')
        );
        
        if (!proPackage) {
          throw new Error('Pro package not found. Please contact support.');
        }

        // Check if Pro is a paid package
        const price = proPackage.price_per_user_monthly || proPackage.base_price_monthly || 0;
        
        if (price > 0) {
          // Paid package - need to go through Stripe checkout
          
          // Create organization first
          const orgSlug = authOrgName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const orgResponse = await fetch('/api/auth/create-organization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: authOrgName.trim(), slug: orgSlug }),
          });

          if (!orgResponse.ok) {
            const errData = await orgResponse.json();
            throw new Error(errData.message || 'Failed to create organization');
          }

          const { organization } = await orgResponse.json();

          // Store signup data for after checkout
          sessionStorage.setItem('signup_data', JSON.stringify({
            email: authEmail,
            password: authPassword,
            name: authName.trim(),
            organizationName: authOrgName.trim(),
            packageId: proPackage.id,
            userQuantity: 1,
            billingInterval: 'month',
            timestamp: Date.now(),
          }));
          
          // Store return URL for after signup completes
          sessionStorage.setItem('signup_return_to', '/affiliates/apply');

          // Redirect to Stripe checkout
          const checkoutResponse = await fetch('/api/stripe/create-signup-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organization_id: organization.id,
              package_id: proPackage.id,
              billing_interval: 'month',
              quantity: 1,
              email: authEmail,
              name: authName.trim(),
              organization_name: authOrgName.trim(),
              success_url: `${window.location.origin}/auth/signup-callback?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${window.location.origin}/affiliates/apply?canceled=true`,
            }),
          });

          if (!checkoutResponse.ok) {
            const errData = await checkoutResponse.json();
            throw new Error(errData.message || 'Failed to create checkout session');
          }

          const { url } = await checkoutResponse.json();
          if (url) {
            window.location.href = url;
            return; // Don't set loading to false - we're redirecting
          }
        } else {
          // Free Pro package - create account directly
          const orgSlug = authOrgName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const orgResponse = await fetch('/api/auth/create-organization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: authOrgName.trim(), slug: orgSlug }),
          });

          if (!orgResponse.ok) {
            const errData = await orgResponse.json();
            throw new Error(errData.message || 'Failed to create organization');
          }

          const { organization } = await orgResponse.json();

          const { data, error: signUpError } = await supabase.auth.signUp({
            email: authEmail,
            password: authPassword,
            options: { 
              data: { 
                name: authName.trim(), 
                organization_id: organization.id,
                role: 'admin',
              } 
            },
          });
          
          if (signUpError) throw signUpError;
          
          if (data.user) {
            // Create user record
            await fetch('/api/auth/create-user-with-org', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: authEmail,
                name: authName.trim(),
                role: 'admin',
                organization_id: organization.id,
              }),
            });
            
            setIsAuthenticated(true);
            setUserEmail(authEmail);
            setFormData(prev => ({ ...prev, email: authEmail, name: authName.trim() }));
            setActiveStep(1);
          }
        }
      } else {
        // Sign in flow
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        
        if (signInError) throw signInError;
        
        if (data.user) {
          setIsAuthenticated(true);
          setUserEmail(data.user.email || '');
          setFormData(prev => ({
            ...prev,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || '',
          }));
          setActiveStep(1);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialLinkChange = (index: number, value: string) => {
    const newLinks = [...formData.social_media_links];
    newLinks[index] = value;
    setFormData(prev => ({ ...prev, social_media_links: newLinks }));
  };

  const addSocialLink = () => {
    setFormData(prev => ({
      ...prev,
      social_media_links: [...prev.social_media_links, ''],
    }));
  };

  const removeSocialLink = (index: number) => {
    const newLinks = formData.social_media_links.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, social_media_links: newLinks }));
  };

  const togglePromotionMethod = (method: string) => {
    setFormData(prev => ({
      ...prev,
      promotion_methods: prev.promotion_methods.includes(method)
        ? prev.promotion_methods.filter(m => m !== method)
        : [...prev.promotion_methods, method],
    }));
  };

  const validateStep = (): boolean => {
    setError(null);
    
    switch (activeStep) {
      case 0: // Account step
        if (!isAuthenticated) {
          setError('Please sign in to continue');
          return false;
        }
        return true;
      case 1: // Personal Info
        if (!formData.name.trim()) {
          setError('Name is required');
          return false;
        }
        if (!formData.email.trim()) {
          setError('Email is required');
          return false;
        }
        return true;
      case 2: // Audience
        if (!formData.audience_size.trim()) {
          setError('Please provide an estimate of your audience size');
          return false;
        }
        return true;
      case 3: // Promotion
        if (formData.promotion_methods.length === 0) {
          setError('Please select at least one promotion method');
          return false;
        }
        return true;
      case 4: // Review
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/affiliates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company_name: formData.company_name || null,
          website: formData.website || null,
          social_media_links: formData.social_media_links.filter(l => l.trim()),
          audience_size: formData.audience_size,
          audience_description: formData.audience_description || null,
          promotion_methods: formData.promotion_methods,
          motivation: formData.motivation || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit application');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Account
        return (
          <Box sx={{ py: 2 }}>
            {isAuthenticated === true ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: theme.palette.success.main, mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                  Account Connected
                </Typography>
                <Alert severity="success" sx={{ maxWidth: 400, mx: 'auto' }}>
                  Signed in as {userEmail}
                </Alert>
              </Box>
            ) : isAuthenticated === false ? (
              <Stack spacing={3}>
                <Box sx={{ textAlign: 'center', mb: 1 }}>
                  <PersonIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1 }} />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {authMode === 'signin' 
                      ? 'Sign in with your existing account' 
                      : 'Create a new account with our Pro plan'}
                  </Typography>
                </Box>

                {/* Auth Mode Tabs */}
                <Tabs
                  value={authMode}
                  onChange={(_, v) => { setAuthMode(v); setAuthError(null); }}
                  centered
                  sx={{ mb: 1 }}
                >
                  <Tab 
                    value="signin" 
                    label="Sign In" 
                    icon={<LoginIcon />} 
                    iconPosition="start"
                  />
                  <Tab 
                    value="signup" 
                    label="Create Account" 
                    icon={<PersonAddIcon />} 
                    iconPosition="start"
                  />
                </Tabs>

                {authError && (
                  <Alert severity="error" onClose={() => setAuthError(null)}>
                    {authError}
                  </Alert>
                )}

                {/* Signup-specific fields */}
                {authMode === 'signup' && (
                  <>
                    <TextField
                      fullWidth
                      label="Full Name"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      disabled={authLoading}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Organization / Company Name"
                      value={authOrgName}
                      onChange={(e) => setAuthOrgName(e.target.value)}
                      disabled={authLoading}
                      required
                      helperText="Your company or brand name"
                    />
                  </>
                )}

                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  disabled={authLoading}
                  required
                />

                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  disabled={authLoading}
                  required
                  helperText={authMode === 'signup' ? 'At least 6 characters' : ''}
                />

                {authMode === 'signup' && (
                  <Alert severity="info" sx={{ py: 1 }}>
                    <Typography variant="body2">
                      Affiliates are automatically enrolled in our <strong>Pro plan</strong>. 
                      You&apos;ll be redirected to complete payment setup.
                    </Typography>
                  </Alert>
                )}

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleInlineAuth}
                  disabled={authLoading}
                  startIcon={authLoading ? <CircularProgress size={20} color="inherit" /> : (authMode === 'signin' ? <LoginIcon /> : <PersonAddIcon />)}
                  sx={{ fontWeight: 600, py: 1.5 }}
                >
                  {authLoading 
                    ? (authMode === 'signin' ? 'Signing In...' : 'Creating Account...') 
                    : (authMode === 'signin' ? 'Sign In' : 'Create Account & Continue')}
                </Button>
              </Stack>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </Box>
        );

      case 1: // Personal Info
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <BusinessIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Personal Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tell us about yourself
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Full Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              disabled={!!userEmail}
              helperText={userEmail ? 'Using your account email' : ''}
            />
            <TextField
              fullWidth
              label="Company/Brand Name (Optional)"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
            />
            <TextField
              fullWidth
              label="Website (Optional)"
              placeholder="https://yourwebsite.com"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
            />
          </Stack>
        );

      case 2: // Audience
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <GroupIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Your Audience
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Help us understand your reach
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Estimated Audience Size"
              placeholder="e.g., 5,000 newsletter subscribers, 10K Twitter followers"
              value={formData.audience_size}
              onChange={(e) => handleInputChange('audience_size', e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Describe Your Audience"
              placeholder="Who are they? Developers, startup founders, product managers..."
              multiline
              rows={3}
              value={formData.audience_description}
              onChange={(e) => handleInputChange('audience_description', e.target.value)}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Social Media Links
              </Typography>
              {formData.social_media_links.map((link, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="https://twitter.com/yourusername"
                    value={link}
                    onChange={(e) => handleSocialLinkChange(index, e.target.value)}
                    InputProps={{
                      endAdornment: formData.social_media_links.length > 1 && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => removeSocialLink(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addSocialLink}
                sx={{ mt: 1 }}
              >
                Add Another Link
              </Button>
            </Box>
          </Stack>
        );

      case 3: // Promotion
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <DescriptionIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Promotion Methods
              </Typography>
              <Typography variant="body2" color="text.secondary">
                How do you plan to promote FullStack Method?
              </Typography>
            </Box>
            <FormGroup>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {promotionMethodOptions.map((method) => (
                  <Chip
                    key={method}
                    label={method}
                    onClick={() => togglePromotionMethod(method)}
                    color={formData.promotion_methods.includes(method) ? 'primary' : 'default'}
                    variant={formData.promotion_methods.includes(method) ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </FormGroup>
            <TextField
              fullWidth
              label="Why do you want to become an affiliate? (Optional)"
              multiline
              rows={4}
              value={formData.motivation}
              onChange={(e) => handleInputChange('motivation', e.target.value)}
              placeholder="Tell us why you're interested in promoting FullStack Method..."
            />
          </Stack>
        );

      case 4: // Review
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: theme.palette.success.main, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Review Your Application
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please review your information before submitting
              </Typography>
            </Box>
            
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Personal Information
                </Typography>
                <Typography><strong>Name:</strong> {formData.name}</Typography>
                <Typography><strong>Email:</strong> {formData.email}</Typography>
                {formData.company_name && (
                  <Typography><strong>Company:</strong> {formData.company_name}</Typography>
                )}
                {formData.website && (
                  <Typography><strong>Website:</strong> {formData.website}</Typography>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Audience
                </Typography>
                <Typography><strong>Size:</strong> {formData.audience_size}</Typography>
                {formData.audience_description && (
                  <Typography><strong>Description:</strong> {formData.audience_description}</Typography>
                )}
                {formData.social_media_links.filter(l => l.trim()).length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography><strong>Social Links:</strong></Typography>
                    {formData.social_media_links.filter(l => l.trim()).map((link, i) => (
                      <Typography key={i} variant="body2" sx={{ ml: 2 }}>• {link}</Typography>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Promotion Methods
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {formData.promotion_methods.map((method) => (
                    <Chip key={method} label={method} size="small" />
                  ))}
                </Box>
                {formData.motivation && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Motivation
                    </Typography>
                    <Typography variant="body2">{formData.motivation}</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        );

      default:
        return null;
    }
  };

  if (success) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
        <LandingHeader />
        <Container maxWidth="sm" sx={{ py: { xs: 12, md: 16 } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card
              sx={{
                textAlign: 'center',
                p: 6,
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 80, color: theme.palette.success.main, mb: 3 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Application Submitted!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Thank you for your interest in becoming an affiliate partner. Our team will review your application and get back to you within 2-3 business days.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push('/')}
                sx={{ fontWeight: 600 }}
              >
                Return Home
              </Button>
            </Card>
          </motion.div>
        </Container>
        <LandingFooter />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      <LandingHeader />
      
      <Container maxWidth="md" sx={{ py: { xs: 12, md: 16 } }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              mb: 1,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Affiliate Application
          </Typography>
          <Typography
            variant="body1"
            sx={{ textAlign: 'center', color: 'text.secondary', mb: 4 }}
          >
            Join our partner program and start earning commissions
          </Typography>

          {/* Stepper */}
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Form Card */}
          <Card
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {error && (
                  <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                {renderStepContent()}

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Button
                    onClick={handleBack}
                    disabled={activeStep === 0 || (activeStep === 1 && isAuthenticated === true)}
                    startIcon={<ArrowBackIcon />}
                    sx={{ visibility: activeStep === 0 || (activeStep === 1 && isAuthenticated === true) ? 'hidden' : 'visible' }}
                  >
                    Back
                  </Button>
                  
                  {activeStep < steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<ArrowForwardIcon />}
                      disabled={activeStep === 0 && isAuthenticated !== true}
                      sx={{ fontWeight: 600, px: 4 }}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={loading}
                      endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                      sx={{ fontWeight: 600, px: 4 }}
                    >
                      {loading ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  )}
                </Box>
              </motion.div>
            </AnimatePresence>
          </Card>
        </motion.div>
      </Container>

      <LandingFooter />
    </Box>
  );
}

export default function AffiliateApplyPage() {
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
      <AffiliateApplyPageContent />
    </Suspense>
  );
}

