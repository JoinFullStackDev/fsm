'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CreditCard as CreditCardIcon,
  Cancel as CancelIcon,
  Upgrade as UpgradeIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { formatPackagePrice } from '@/lib/packagePricing';
import type { Package as PackageType } from '@/lib/organizationContext';

interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_interval: 'month' | 'year' | null;
  package: PackageType;
}

interface Package {
  id: string;
  name: string;
  pricing_model: 'per_user' | 'flat_rate';
  price_per_user_monthly: number | null;
  price_per_user_yearly: number | null;
  base_price_monthly: number | null;
  base_price_yearly: number | null;
  features: any;
}

export default function AdminSubscriptionTab() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { organization } = useOrganization();
  const supabase = createSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [changePackageDialog, setChangePackageDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<'month' | 'year'>('month');
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/organization/subscription');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load subscription');
      }
      const data = await response.json();
      console.log('[AdminSubscriptionTab] Subscription data:', data);
      setSubscription(data.subscription || null);
    } catch (err) {
      console.error('[AdminSubscriptionTab] Error loading subscription:', err);
      showError(err instanceof Error ? err.message : 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadPackages = useCallback(async () => {
    try {
      const response = await fetch('/api/packages');
      if (!response.ok) {
        throw new Error('Failed to load packages');
      }
      const data = await response.json();
      setPackages(data.packages || []);
    } catch (err) {
      console.error('Error loading packages:', err);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
    loadPackages();
  }, [loadSubscription, loadPackages]);

  const handleChangePackage = async () => {
    if (!selectedPackageId) {
      showError('Please select a package');
      return;
    }

    setLoadingAction(true);
    try {
      const response = await fetch('/api/organization/subscription/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackageId,
          billing_interval: selectedBillingInterval,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change package');
      }

      showSuccess('Package changed successfully');
      setChangePackageDialog(false);
      setSelectedPackageId('');
      setSelectedBillingInterval('month');
      loadSubscription();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to change package');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancelSubscription = async () => {
    setLoadingAction(true);
    try {
      const response = await fetch('/api/organization/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancel_immediately: cancelImmediately,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      showSuccess('Subscription canceled successfully');
      setCancelDialog(false);
      loadSubscription();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_url: window.location.href,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'info';
      case 'past_due':
        return 'warning';
      case 'canceled':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!subscription) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Subscription Management
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          No subscription record found. Your organization may be on a trial or free plan.
        </Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Organization Status
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Subscription Status
                  </Typography>
                  <Chip
                    label={organization?.subscription_status || 'trial'}
                    color={organization?.subscription_status === 'active' ? 'success' : 'default'}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  {organization?.stripe_customer_id && (
                    <>
                      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                        Stripe Customer ID
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.875rem', mb: 2 }}
                      >
                        {organization.stripe_customer_id}
                      </Typography>
                    </>
                  )}
                  {organization?.trial_ends_at && (
                    <>
                      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                        Trial Ends
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {formatDate(organization.trial_ends_at)}
                      </Typography>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Next Steps
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  To set up a subscription, please contact support or visit the billing portal.
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<CreditCardIcon />}
                    endIcon={<OpenInNewIcon />}
                    onClick={handleOpenPortal}
                    disabled={!organization?.stripe_customer_id}
                  >
                    {organization?.stripe_customer_id ? 'Manage Billing' : 'Billing Portal Unavailable'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  const availablePackages = packages.filter((pkg) => pkg.id !== subscription.package.id);

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Subscription Management
      </Typography>

      <Grid container spacing={3}>
        {/* Current Subscription Details */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Current Subscription</Typography>
                <Chip
                  label={subscription.status}
                  color={getStatusColor(subscription.status) as any}
                  size="small"
                />
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          Package
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{subscription.package.name}</Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          Price
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatPackagePrice(
                            subscription.package,
                            (subscription.billing_interval || 'month') as 'month' | 'year'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          Current Period
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(subscription.current_period_start)} -{' '}
                          {formatDate(subscription.current_period_end)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          Stripe Subscription ID
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {subscription.stripe_subscription_id || 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {subscription.cancel_at_period_end && (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            This subscription will cancel at the end of the current billing period.
                          </Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Organization Info */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Organization Details
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Organization Status
                </Typography>
                <Chip
                  label={organization?.subscription_status || 'trial'}
                  color={organization?.subscription_status === 'active' ? 'success' : 'default'}
                  size="small"
                  sx={{ mb: 2 }}
                />
                {organization?.stripe_customer_id && (
                  <>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                      Stripe Customer ID
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: '0.875rem', mb: 2 }}
                    >
                      {organization.stripe_customer_id}
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Subscription Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<UpgradeIcon />}
                  onClick={() => setChangePackageDialog(true)}
                  disabled={subscription.status === 'canceled'}
                >
                  Change Package
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setCancelDialog(true)}
                  disabled={subscription.status === 'canceled' || subscription.cancel_at_period_end}
                >
                  Cancel Subscription
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CreditCardIcon />}
                  endIcon={<OpenInNewIcon />}
                  onClick={handleOpenPortal}
                >
                  Manage Billing
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Change Package Dialog */}
      <Dialog open={changePackageDialog} onClose={() => setChangePackageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Package</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select a new package. Your subscription will be updated immediately with prorated billing.
          </DialogContentText>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Package</InputLabel>
            <Select
              value={selectedPackageId}
              onChange={(e) => {
                setSelectedPackageId(e.target.value);
                // Reset billing interval when package changes
                setSelectedBillingInterval('month');
              }}
              label="Select Package"
            >
              {availablePackages.map((pkg) => {
                const monthlyPrice = pkg.pricing_model === 'per_user' 
                  ? pkg.price_per_user_monthly 
                  : pkg.base_price_monthly;
                const yearlyPrice = pkg.pricing_model === 'per_user'
                  ? pkg.price_per_user_yearly
                  : pkg.base_price_yearly;
                const hasMonthly = monthlyPrice !== null && monthlyPrice !== undefined;
                const hasYearly = yearlyPrice !== null && yearlyPrice !== undefined;
                const priceDisplay = hasMonthly && hasYearly
                  ? `$${monthlyPrice?.toFixed(2) || 0}/mo or $${yearlyPrice?.toFixed(2) || 0}/yr`
                  : hasMonthly
                  ? `$${monthlyPrice?.toFixed(2) || 0}/mo`
                  : hasYearly
                  ? `$${yearlyPrice?.toFixed(2) || 0}/yr`
                  : 'Free';
                return (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.name} - {priceDisplay}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          {selectedPackageId && (() => {
            const selectedPkg = availablePackages.find(p => p.id === selectedPackageId);
            const hasMonthly = selectedPkg && (
              (selectedPkg.pricing_model === 'per_user' && selectedPkg.price_per_user_monthly !== null) ||
              (selectedPkg.pricing_model === 'flat_rate' && selectedPkg.base_price_monthly !== null)
            );
            const hasYearly = selectedPkg && (
              (selectedPkg.pricing_model === 'per_user' && selectedPkg.price_per_user_yearly !== null) ||
              (selectedPkg.pricing_model === 'flat_rate' && selectedPkg.base_price_yearly !== null)
            );
            if (hasMonthly && hasYearly) {
              return (
                <FormControl fullWidth>
                  <InputLabel>Billing Interval</InputLabel>
                  <Select
                    value={selectedBillingInterval}
                    onChange={(e) => setSelectedBillingInterval(e.target.value as 'month' | 'year')}
                    label="Billing Interval"
                  >
                    <MenuItem value="month">Monthly</MenuItem>
                    <MenuItem value="year">Yearly</MenuItem>
                  </Select>
                </FormControl>
              );
            }
            return null;
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePackageDialog(false)}>Cancel</Button>
          <Button onClick={handleChangePackage} variant="contained" disabled={!selectedPackageId || loadingAction}>
            {loadingAction ? <CircularProgress size={20} /> : 'Change Package'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to cancel your subscription?
          </DialogContentText>
          <FormControl fullWidth>
            <Select
              value={cancelImmediately ? 'immediate' : 'end_of_period'}
              onChange={(e) => setCancelImmediately(e.target.value === 'immediate')}
            >
              <MenuItem value="end_of_period">
                Cancel at end of billing period ({formatDate(subscription.current_period_end)})
              </MenuItem>
              <MenuItem value="immediate">Cancel immediately</MenuItem>
            </Select>
          </FormControl>
          {cancelImmediately && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Canceling immediately will end your access right away. You will not receive a refund for the
              current period.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog(false)}>Keep Subscription</Button>
          <Button
            onClick={handleCancelSubscription}
            variant="contained"
            color="error"
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Cancel Subscription'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

