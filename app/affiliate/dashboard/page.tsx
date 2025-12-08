'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  InputAdornment,
  TextField,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Link as LinkIcon,
  LocalOffer as OfferIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface AffiliateStats {
  is_affiliate: boolean;
  has_code: boolean;
  affiliate_code?: string;
  referral_link?: string;
  discount?: {
    type: string;
    value: number;
    duration_months: number | null;
    bonus_trial_days: number;
  };
  commission_percentage?: number;
  stats?: {
    total_conversions: number;
    total_commission: number;
    paid_commission: number;
    pending_commission: number;
    current_uses: number;
    max_uses: number | null;
  };
  recent_conversions?: Array<{
    id: string;
    date: string;
    discount_applied: number;
    commission: number;
    paid: boolean;
  }>;
  message?: string;
}

interface ApplicationStatus {
  has_application: boolean;
  application?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    name: string;
    email: string;
    company_name: string | null;
    website: string | null;
    audience_size: string;
    promotion_methods: string[];
    created_at: string;
    reviewed_at: string | null;
    reviewer: { name: string } | null;
  };
  message?: string;
}

export default function AffiliateDashboardPage() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AffiliateStats | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try to get affiliate stats (for approved affiliates)
      const response = await fetch('/api/affiliate/stats');
      
      if (response.status === 401) {
        router.push('/auth/signin?redirect=/affiliate/dashboard');
        return;
      }
      
      if (response.status === 403) {
        // User is not an approved affiliate - check if they have a pending application
        const appResponse = await fetch('/api/affiliate/application-status');
        if (appResponse.ok) {
          const appData = await appResponse.json();
          setApplicationStatus(appData);
        }
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to load stats');
      }

      const statsData = await response.json();
      setData(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // Show application status if user has a pending/rejected application
  if (applicationStatus?.has_application && !data) {
    const app = applicationStatus.application!;
    const statusColors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
    } as const;
    
    const statusMessages = {
      pending: 'Your application is being reviewed by our team. We\'ll notify you once a decision has been made.',
      approved: 'Your application has been approved! Your affiliate dashboard should be available shortly.',
      rejected: 'Unfortunately, your application was not approved at this time. You may apply again in the future.',
    };

    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  backgroundColor: alpha(
                    theme.palette[statusColors[app.status]].main,
                    0.1
                  ),
                }}
              >
                {app.status === 'pending' && (
                  <InfoIcon sx={{ fontSize: 40, color: theme.palette.warning.main }} />
                )}
                {app.status === 'approved' && (
                  <CheckIcon sx={{ fontSize: 40, color: theme.palette.success.main }} />
                )}
                {app.status === 'rejected' && (
                  <InfoIcon sx={{ fontSize: 40, color: theme.palette.error.main }} />
                )}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Application Status
              </Typography>
              <Chip
                label={app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                color={statusColors[app.status]}
                sx={{ fontWeight: 600, fontSize: '0.9rem', px: 2 }}
              />
            </Box>

            <Alert 
              severity={statusColors[app.status]} 
              sx={{ mb: 4 }}
            >
              {statusMessages[app.status]}
            </Alert>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Application Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {app.name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {app.email}
                </Typography>
              </Grid>
              {app.company_name && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Company
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {app.company_name}
                  </Typography>
                </Grid>
              )}
              {app.website && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Website
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {app.website}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Audience Size
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {app.audience_size}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Submitted
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {new Date(app.created_at).toLocaleDateString()}
                </Typography>
              </Grid>
              {app.reviewed_at && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Reviewed
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {new Date(app.reviewed_at).toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Promotion Methods
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {app.promotion_methods?.map((method) => (
                    <Chip key={method} label={method} size="small" variant="outlined" />
                  ))}
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/dashboard')}
              >
                Return to Dashboard
              </Button>
              {app.status === 'rejected' && (
                <Button
                  variant="contained"
                  onClick={() => router.push('/affiliates/apply')}
                >
                  Apply Again
                </Button>
              )}
            </Box>
          </Card>
        </motion.div>
      </Container>
    );
  }

  // Show prompt to apply if no application exists
  if (!data && !applicationStatus?.has_application) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Card sx={{ textAlign: 'center', p: 6 }}>
          <InfoIcon sx={{ fontSize: 64, color: theme.palette.info.main, mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
            Become an Affiliate
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Join our affiliate program and start earning commissions by referring new customers.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" onClick={() => router.push('/affiliates/apply')}>
              Apply Now
            </Button>
            <Button variant="outlined" onClick={() => router.push('/affiliates')}>
              Learn More
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (!data?.has_code) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Card sx={{ textAlign: 'center', p: 6 }}>
          <InfoIcon sx={{ fontSize: 64, color: theme.palette.warning.main, mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
            Affiliate Setup Pending
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {data?.message || 'Your affiliate account is being set up. Please check back soon.'}
          </Typography>
          <Button variant="outlined" onClick={() => router.push('/dashboard')}>
            Return to Dashboard
          </Button>
        </Card>
      </Container>
    );
  }

  const stats = data?.stats;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Affiliate Dashboard
          </Typography>
          <Typography color="text.secondary">
            Track your referrals, commissions, and share your unique link
          </Typography>
        </Box>

        {/* Referral Link Card */}
        <Card
          sx={{
            mb: 4,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <LinkIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Your Referral Link
              </Typography>
            </Box>
            <TextField
              fullWidth
              value={data?.referral_link || ''}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                      <IconButton onClick={() => copyToClipboard(data?.referral_link || '')}>
                        {copied ? <CheckIcon color="success" /> : <CopyIcon />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: theme.palette.background.paper,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                },
              }}
            />
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                icon={<OfferIcon />}
                label={`${data?.discount?.value}% off for referrals`}
                size="small"
                color="primary"
                variant="outlined"
              />
              {data?.discount?.bonus_trial_days && data.discount.bonus_trial_days > 0 && (
                <Chip
                  label={`+${data.discount.bonus_trial_days} trial days`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}
              <Chip
                label={`You earn ${data?.commission_percentage}% commission`}
                size="small"
                color="success"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    }}
                  >
                    <PeopleIcon sx={{ color: theme.palette.primary.main }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats?.total_conversions || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Conversions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(theme.palette.success.main, 0.1),
                    }}
                  >
                    <MoneyIcon sx={{ color: theme.palette.success.main }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      ${(stats?.total_commission || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Commission
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(theme.palette.warning.main, 0.1),
                    }}
                  >
                    <TrendingUpIcon sx={{ color: theme.palette.warning.main }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      ${(stats?.pending_commission || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Payout
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                    }}
                  >
                    <CheckIcon sx={{ color: theme.palette.info.main }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      ${(stats?.paid_commission || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Paid Out
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Conversions */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Recent Conversions
            </Typography>
            {data?.recent_conversions && data.recent_conversions.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Discount Applied</TableCell>
                      <TableCell>Commission</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recent_conversions.map((conversion) => (
                      <TableRow key={conversion.id}>
                        <TableCell>
                          {new Date(conversion.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          ${(conversion.discount_applied || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          ${(conversion.commission || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={conversion.paid ? 'Paid' : 'Pending'}
                            size="small"
                            color={conversion.paid ? 'success' : 'warning'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  No conversions yet. Share your referral link to start earning!
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Quick Share Section */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Share Your Link
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={() => copyToClipboard(data?.referral_link || '')}
                sx={{ flex: 1 }}
              >
                Copy Link
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  const text = `Check out FullStack Method - use my referral link for ${data?.discount?.value}% off! ${data?.referral_link}`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                }}
                sx={{ flex: 1 }}
              >
                Share on Twitter
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data?.referral_link || '')}`, '_blank');
                }}
                sx={{ flex: 1 }}
              >
                Share on LinkedIn
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </motion.div>
    </Container>
  );
}

