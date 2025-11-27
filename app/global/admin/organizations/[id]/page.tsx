'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  CreditCard as CreditCardIcon,
  Settings as SettingsIcon,
  AutoAwesome as AIIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`org-tabpanel-${index}`}
      aria-labelledby={`org-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function OrganizationDetailPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [organization, setOrganization] = useState<any>(null);

  useEffect(() => {
    if (params.id) {
      loadOrganization();
    }
  }, [params.id]);

  const loadOrganization = async () => {
    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}`);
      if (!response.ok) {
        throw new Error('Failed to load organization');
      }
      const data = await response.json();
      setOrganization(data.organization);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organization';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          Organization not found
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/global/admin/organizations')}
        >
          Back
        </Button>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.75rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          {organization.name}
        </Typography>
        <Chip
          label={organization.subscription_status}
          color={
            organization.subscription_status === 'active'
              ? 'success'
              : organization.subscription_status === 'trial'
              ? 'info'
              : organization.subscription_status === 'past_due'
              ? 'warning'
              : 'error'
          }
        />
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab icon={<BusinessIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<CreditCardIcon />} label="Subscription" iconPosition="start" />
          <Tab icon={<CreditCardIcon />} label="Payments" iconPosition="start" />
          <Tab icon={<SettingsIcon />} label="Add-ons" iconPosition="start" />
          <Tab icon={<AIIcon />} label="AI Usage" iconPosition="start" />
          <Tab icon={<StorageIcon />} label="All Data" iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Organization Details
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Name: {organization.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Slug: {organization.slug}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(organization.created_at).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Stripe Customer ID: {organization.stripe_customer_id || 'N/A'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Usage Statistics
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Users: {organization.user_count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Projects: {organization.project_count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Templates: {organization.template_count || 0}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Subscription Management
          </Typography>
          {organization.subscription ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Status: {organization.subscription.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Package: {organization.package?.name || 'None'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Period: {organization.subscription.current_period_start 
                  ? new Date(organization.subscription.current_period_start).toLocaleDateString()
                  : 'N/A'} - {organization.subscription.current_period_end
                  ? new Date(organization.subscription.current_period_end).toLocaleDateString()
                  : 'N/A'}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" sx={{ mr: 1 }}>
                  Change Package
                </Button>
                <Button variant="outlined" sx={{ mr: 1 }}>
                  Cancel Subscription
                </Button>
                <Button variant="outlined">
                  Extend Trial
                </Button>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No active subscription
            </Typography>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Payment Details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Payment management features coming soon...
          </Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Add-on Controls
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Add-on management features coming soon...
          </Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            AI Usage Tracking
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            AI usage tracking features coming soon...
          </Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" gutterBottom>
            All Organization Data (GOD MODE)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Full data access features coming soon...
          </Typography>
        </TabPanel>
      </Paper>
    </Box>
  );
}

