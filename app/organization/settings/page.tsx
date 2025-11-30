'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  CreditCard as CreditCardIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { LimitCheckResult } from '@/lib/packageLimits';
import { formatPackagePrice } from '@/lib/packagePricing';

export default function OrganizationSettingsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { organization, subscription, package: packageData, features, loading, refresh } = useOrganization();
  const { showSuccess, showError } = useNotification();
  const [organizationName, setOrganizationName] = useState('');
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<{
    projects: LimitCheckResult;
    users: LimitCheckResult;
    templates: LimitCheckResult;
    features: {
      ai: boolean;
      export: boolean;
      opsTool: boolean;
      analytics: boolean;
      apiAccess: boolean;
    };
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated' | null;
  } | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(true);

  useEffect(() => {
    if (organization) {
      setOrganizationName(organization.name);
    }
  }, [organization]);

  useEffect(() => {
    const loadLimits = async () => {
      if (!organization) return;

      try {
        const response = await fetch('/api/organization/limits');
        if (response.ok) {
          const data = await response.json();
          setLimits(data);
        }
      } catch (err) {
        console.error('Error loading limits:', err);
      } finally {
        setLoadingLimits(false);
      }
    };

    if (organization) {
      loadLimits();
    }
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/organization/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: organizationName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update organization');
      }

      showSuccess('Organization updated successfully');
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update organization';
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageData?.id, // This would be the upgraded package
          success_url: `${window.location.origin}/organization/settings?success=true`,
          cancel_url: `${window.location.origin}/organization/settings?canceled=true`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start checkout';
      showError(errorMessage);
    }
  };

  const handleBillingPortal = async () => {
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_url: `${window.location.origin}/organization/settings`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to open billing portal';
      showError(errorMessage);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box p={3}>
        <Alert severity="error">Organization not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
      <Box mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mb: 2, color: theme.palette.text.primary }}
        >
          Back
        </Button>
        <Typography
          variant="h4"
          sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Organization Settings
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Organization Profile */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ color: theme.palette.text.primary }}>
              Organization Profile
            </Typography>
            <TextField
              fullWidth
              label="Organization Name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Slug"
              value={organization.slug}
              disabled
              margin="normal"
              size="small"
              helperText="Organization slug cannot be changed"
            />
            <Box mt={2}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{
                  backgroundColor: theme.palette.text.primary,
                  color: theme.palette.background.paper,
                  '&:hover': {
                    backgroundColor: theme.palette.text.secondary,
                  },
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Subscription & Billing */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ color: theme.palette.text.primary }}>
              Subscription
            </Typography>
            {packageData ? (
              <>
                <Chip
                  label={packageData.name}
                  color={subscription?.status === 'active' ? 'success' : 'default'}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {formatPackagePrice(packageData, (subscription?.billing_interval || 'month') as 'month' | 'year')}
                </Typography>
                {subscription?.current_period_end && (
                  <Typography variant="body2" color="text.secondary">
                    Renews: {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                      timeZone: 'America/Phoenix',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Typography>
                )}
                <Box mt={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CreditCardIcon />}
                    onClick={handleBillingPortal}
                    sx={{
                      borderColor: theme.palette.text.primary,
                      color: theme.palette.text.primary,
                      '&:hover': {
                        borderColor: theme.palette.text.secondary,
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    Manage Billing
                  </Button>
                </Box>
              </>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                No active subscription
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Usage & Limits */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ color: theme.palette.text.primary }}>
              Usage & Limits
            </Typography>
            {loadingLimits ? (
              <CircularProgress />
            ) : limits ? (
              <Grid container spacing={2} mt={1}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Projects
                      </Typography>
                      <Typography variant="h4">
                        {limits.projects.current || 0}
                        {limits.projects.limit !== null && ` / ${limits.projects.limit}`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Users
                      </Typography>
                      <Typography variant="h4">
                        {limits.users.current || 0}
                        {limits.users.limit !== null && ` / ${limits.users.limit}`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Templates
                      </Typography>
                      <Typography variant="h4">
                        {limits.templates.current || 0}
                        {limits.templates.limit !== null && ` / ${limits.templates.limit}`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            ) : null}
          </Paper>
        </Grid>

        {/* Features */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ color: theme.palette.text.primary }}>
              Features
            </Typography>
            {features && (
              <Grid container spacing={2} mt={1}>
                <Grid item xs={12} sm={6} md={3}>
                  <Chip
                    label="AI Features"
                    color={features.ai_features_enabled ? 'success' : 'default'}
                    variant={features.ai_features_enabled ? 'filled' : 'outlined'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Chip
                    label="Export Features"
                    color={features.export_features_enabled ? 'success' : 'default'}
                    variant={features.export_features_enabled ? 'filled' : 'outlined'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Chip
                    label="Ops Tool"
                    color={features.ops_tool_enabled ? 'success' : 'default'}
                    variant={features.ops_tool_enabled ? 'filled' : 'outlined'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Chip
                    label="Analytics"
                    color={features.analytics_enabled ? 'success' : 'default'}
                    variant={features.analytics_enabled ? 'filled' : 'outlined'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Chip
                    label="API Access"
                    color={features.api_access_enabled ? 'success' : 'default'}
                    variant={features.api_access_enabled ? 'filled' : 'outlined'}
                  />
                </Grid>
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

