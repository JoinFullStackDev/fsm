'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  CreditCard as CreditCardIcon,
  Settings as SettingsIcon,
  AutoAwesome as AIIcon,
  Storage as StorageIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import { AVAILABLE_MODULES, getModulesByCategory } from '@/lib/modules';
import { formatPackagePrice } from '@/lib/packagePricing';
import {
  AutoAwesome,
  Download,
  Analytics,
  Api,
  Dashboard,
} from '@mui/icons-material';

// Icon mapping for module icons (only import what we need)
// BusinessIcon is already imported above
const iconMap: Record<string, React.ComponentType<any>> = {
  Business: BusinessIcon,
  AutoAwesome,
  Download,
  Analytics,
  Api,
  Dashboard,
};

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
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [organization, setOrganization] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [availableAddons, setAvailableAddons] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, boolean>>({});
  const [savingModule, setSavingModule] = useState<string | null>(null);

  // Dialog states
  const [changePackageDialog, setChangePackageDialog] = useState(false);
  const [giftPackageDialog, setGiftPackageDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [collectPaymentDialog, setCollectPaymentDialog] = useState(false);

  // Form states
  const [selectedPackage, setSelectedPackage] = useState('');
  const [giftPackageId, setGiftPackageId] = useState('');
  const [giftBillingInterval, setGiftBillingInterval] = useState<'month' | 'year'>('month');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [cancelImmediately, setCancelImmediately] = useState(false);

  const loadOrganization = useCallback(async () => {
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
  }, [params.id, showError]);

  const loadPackages = useCallback(async () => {
    try {
      const response = await fetch('/api/global/admin/packages');
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/payments`);
      if (response.ok) {
        const data = await response.json();
        setPayments(data.invoices || []);
      }
    } catch (err) {
      showError('Failed to load payments');
    } finally {
      setLoadingPayments(false);
    }
  }, [params.id, showError]);

  const loadModules = useCallback(async () => {
    setLoadingAddons(true);
    try {
      // Reload organization to get latest module overrides
      await loadOrganization();
    } catch (err) {
      showError('Failed to load modules');
    } finally {
      setLoadingAddons(false);
    }
  }, [loadOrganization, showError]);

  useEffect(() => {
    if (params.id) {
      loadOrganization();
      loadPackages();
    }
  }, [params.id, loadOrganization, loadPackages]);

  useEffect(() => {
    if (tabValue === 2 && params.id) {
      loadPayments();
    }
    if (tabValue === 3 && params.id) {
      loadModules();
    }
  }, [tabValue, params.id, loadPayments, loadModules]);

  useEffect(() => {
    if (organization) {
      // Load module overrides from organization
      setModuleOverrides(organization.module_overrides || {});
    }
  }, [organization]);

  const handleToggleModule = async (moduleKey: string, enabled: boolean) => {
    setSavingModule(moduleKey);
    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_key: moduleKey,
          enabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update module');
      }

      // Update local state
      setModuleOverrides((prev) => ({
        ...prev,
        [moduleKey]: enabled,
      }));

      showSuccess(`${enabled ? 'Enabled' : 'Disabled'} ${AVAILABLE_MODULES.find(m => m.key === moduleKey)?.name || moduleKey}`);
      await loadOrganization();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update module');
    } finally {
      setSavingModule(null);
    }
  };

  const getModuleIcon = (iconName?: string) => {
    if (!iconName) return BusinessIcon;
    return iconMap[iconName] || BusinessIcon;
  };

  const getModuleStatus = (moduleKey: string): { enabled: boolean; source: 'override' | 'package' | 'default' } => {
    // Check organization override first
    if (moduleKey in moduleOverrides) {
      return { enabled: moduleOverrides[moduleKey], source: 'override' };
    }
    
    // Check package feature
    if (organization?.package?.features) {
      const packageValue = (organization.package.features as any)[moduleKey];
      if (packageValue !== undefined) {
        return { enabled: packageValue === true || packageValue === null, source: 'package' };
      }
    }
    
    // Default to false
    return { enabled: false, source: 'default' };
  };

  const handleChangePackage = async () => {
    if (!selectedPackage) {
      showError('Please select a package');
      return;
    }

    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_package',
          package_id: selectedPackage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change package');
      }

      showSuccess('Package changed successfully');
      setChangePackageDialog(false);
      setSelectedPackage('');
      loadOrganization();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to change package');
    }
  };

  const handleGiftPackage = async () => {
    if (!giftPackageId) {
      showError('Please select a package');
      return;
    }

    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'gift_package',
          package_id: giftPackageId,
          billing_interval: giftBillingInterval,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to gift package');
      }

      const data = await response.json();
      showSuccess(`Package "${data.package?.name || 'selected package'}" gifted successfully`);
      setGiftPackageDialog(false);
      setGiftPackageId('');
      setGiftBillingInterval('month');
      loadOrganization();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to gift package');
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          cancel_at_period_end: !cancelImmediately,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      showSuccess('Subscription canceled successfully');
      setCancelDialog(false);
      loadOrganization();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reactivate',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reactivate subscription');
      }

      showSuccess('Subscription reactivated successfully');
      loadOrganization();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    }
  };

  const handleCollectPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          description: paymentDescription || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const data = await response.json();
      showSuccess('Invoice created and sent successfully');
      setCollectPaymentDialog(false);
      setPaymentAmount('');
      setPaymentDescription('');
      loadPayments();
      
      if (data.invoice_url) {
        window.open(data.invoice_url, '_blank');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to collect payment');
    }
  };

  const handleCreateCheckout = async (packageId: string) => {
    try {
      const response = await fetch(`/api/global/admin/organizations/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create checkout');
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

  const unpaidInvoices = payments.filter((p) => p.status === 'open' || p.status === 'draft');
  const hasUnpaid = unpaidInvoices.length > 0;

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
              : organization.subscription_status === 'trialing'
              ? 'info'
              : organization.subscription_status === 'past_due'
              ? 'warning'
              : 'error'
          }
        />
        {hasUnpaid && (
          <Chip
            label={`${unpaidInvoices.length} Unpaid Invoice${unpaidInvoices.length > 1 ? 's' : ''}`}
            color="error"
          />
        )}
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab icon={<BusinessIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<CreditCardIcon />} label="Subscription" iconPosition="start" />
          <Tab icon={<PaymentIcon />} label="Payments" iconPosition="start" />
          <Tab icon={<SettingsIcon />} label="Modules" iconPosition="start" />
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
                  Created: {new Date(organization.created_at).toLocaleDateString('en-US', {
                    timeZone: 'America/Phoenix',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Subscription Management</Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadOrganization}
            >
              Refresh
            </Button>
          </Box>

          {organization.subscription ? (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={organization.subscription.status}
                      color={
                        organization.subscription.status === 'active'
                          ? 'success'
                          : organization.subscription.status === 'past_due'
                          ? 'warning'
                          : 'error'
                      }
                      sx={{ mt: 1 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Current Package
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                      {organization.package?.name || 'None'}
                    </Typography>
                    {organization.package && organization.subscription && (
                      <Typography variant="body2" color="text.secondary">
                        {formatPackagePrice(
                          organization.package,
                          (organization.subscription.billing_interval || 'month') as 'month' | 'year'
                        )}
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Current Period
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {organization.subscription.current_period_start
                        ? new Date(organization.subscription.current_period_start).toLocaleDateString('en-US', {
                            timeZone: 'America/Phoenix',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}{' '}
                      -{' '}
                      {organization.subscription.current_period_end
                        ? new Date(organization.subscription.current_period_end).toLocaleDateString('en-US', {
                            timeZone: 'America/Phoenix',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </Typography>
                  </Grid>
                  {organization.subscription.cancel_at_period_end && (
                    <Grid item xs={12}>
                      <Alert severity="warning">
                        Subscription will cancel at the end of the current period
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              No active subscription. Create one by selecting a package below.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={() => setChangePackageDialog(true)}
            >
              {organization.subscription ? 'Change Package' : 'Create Subscription'}
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => setGiftPackageDialog(true)}
            >
              Gift Package
            </Button>
            {organization.subscription && (
              <>
                {organization.subscription.cancel_at_period_end ? (
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={handleReactivateSubscription}
                  >
                    Reactivate Subscription
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setCancelDialog(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Payment History</Typography>
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={() => setCollectPaymentDialog(true)}
            >
              Collect Payment
            </Button>
          </Box>

          {hasUnpaid && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              This organization has {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length > 1 ? 's' : ''}.
              Click &quot;Collect Payment&quot; to send an invoice.
            </Alert>
          )}

          {loadingPayments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : payments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No payment history found
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number || invoice.id}</TableCell>
                      <TableCell>${invoice.amount_due.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status}
                          size="small"
                          color={
                            invoice.status === 'paid'
                              ? 'success'
                              : invoice.status === 'open'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.created).toLocaleDateString('en-US', {
                          timeZone: 'America/Phoenix',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date
                          ? new Date(invoice.due_date).toLocaleDateString('en-US', {
                              timeZone: 'America/Phoenix',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        {invoice.hosted_invoice_url && (
                          <IconButton
                            size="small"
                            onClick={() => window.open(invoice.hosted_invoice_url, '_blank')}
                          >
                            <OpenInNewIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Modules & Plugins
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enable or disable modules for this organization. Organization overrides take precedence over package defaults.
            </Typography>
          </Box>

          {loadingAddons ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {Object.entries(getModulesByCategory()).map(([category, modules]) => (
                <Grid item xs={12} key={category}>
                  <Paper
                    sx={{
                      p: 3,
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        mb: 2,
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        fontSize: '0.75rem',
                      }}
                    >
                      {category}
                    </Typography>
                    <Grid container spacing={2}>
                      {modules.map((module) => {
                        const IconComponent = getModuleIcon(module.icon);
                        const status = getModuleStatus(module.key);
                        const isSaving = savingModule === module.key;

                        return (
                          <Grid item xs={12} md={6} key={module.key}>
                            <Card
                              sx={{
                                border: `1px solid ${theme.palette.divider}`,
                                backgroundColor: theme.palette.background.default,
                              }}
                            >
                              <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                                    <IconComponent
                                      sx={{
                                        fontSize: 32,
                                        color: status.enabled
                                          ? theme.palette.text.primary
                                          : theme.palette.text.secondary,
                                        mt: 0.5,
                                      }}
                                    />
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                                        {module.name}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {module.description}
                                      </Typography>
                                      <Chip
                                        label={
                                          status.source === 'override'
                                            ? 'Organization Override'
                                            : status.source === 'package'
                                            ? 'From Package'
                                            : 'Default'
                                        }
                                        size="small"
                                        sx={{
                                          fontSize: '0.65rem',
                                          height: 20,
                                          backgroundColor:
                                            status.source === 'override'
                                              ? theme.palette.info.dark
                                              : theme.palette.action.hover,
                                          color: theme.palette.text.secondary,
                                        }}
                                      />
                                    </Box>
                                  </Box>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        checked={status.enabled}
                                        onChange={(e) => handleToggleModule(module.key, e.target.checked)}
                                        disabled={isSaving}
                                        sx={{
                                          '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: theme.palette.text.primary,
                                          },
                                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            backgroundColor: theme.palette.text.primary,
                                          },
                                        }}
                                      />
                                    }
                                    label=""
                                    sx={{ m: 0 }}
                                  />
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
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

      {/* Change Package Dialog */}
      <Dialog open={changePackageDialog} onClose={() => setChangePackageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Package</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Package</InputLabel>
            <Select
              value={selectedPackage}
              label="Select Package"
              onChange={(e) => setSelectedPackage(e.target.value)}
            >
              {packages.map((pkg) => {
                const pricingModel = pkg.pricing_model || 'per_user';
                const monthlyPrice = pricingModel === 'per_user' 
                  ? pkg.price_per_user_monthly 
                  : pkg.base_price_monthly;
                const yearlyPrice = pricingModel === 'per_user'
                  ? pkg.price_per_user_yearly
                  : pkg.base_price_yearly;
                
                let priceDisplay = '';
                if (monthlyPrice && yearlyPrice) {
                  priceDisplay = `$${monthlyPrice.toFixed(2)}/mo or $${yearlyPrice.toFixed(2)}/yr`;
                } else if (monthlyPrice) {
                  priceDisplay = `$${monthlyPrice.toFixed(2)}/mo`;
                } else if (yearlyPrice) {
                  priceDisplay = `$${yearlyPrice.toFixed(2)}/yr`;
                } else {
                  priceDisplay = 'Free';
                }
                
                const suffix = pricingModel === 'per_user' ? '/user' : '';
                return (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.name} - {priceDisplay}{suffix}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePackageDialog(false)}>Cancel</Button>
          <Button onClick={handleChangePackage} variant="contained">
            Change Package
          </Button>
        </DialogActions>
      </Dialog>

      {/* Gift Package Dialog */}
      <Dialog open={giftPackageDialog} onClose={() => setGiftPackageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Gift Package</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will assign a package to this organization without payment. The subscription will be active immediately with no trial period.
          </Alert>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Package</InputLabel>
            <Select
              value={giftPackageId}
              label="Select Package"
              onChange={(e) => setGiftPackageId(e.target.value)}
            >
              {packages.map((pkg) => {
                const pricingModel = pkg.pricing_model || 'per_user';
                const monthlyPrice = pricingModel === 'per_user' 
                  ? pkg.price_per_user_monthly 
                  : pkg.base_price_monthly;
                const yearlyPrice = pricingModel === 'per_user'
                  ? pkg.price_per_user_yearly
                  : pkg.base_price_yearly;
                
                let priceDisplay = '';
                if (monthlyPrice && yearlyPrice) {
                  priceDisplay = `$${monthlyPrice.toFixed(2)}/mo or $${yearlyPrice.toFixed(2)}/yr`;
                } else if (monthlyPrice) {
                  priceDisplay = `$${monthlyPrice.toFixed(2)}/mo`;
                } else if (yearlyPrice) {
                  priceDisplay = `$${yearlyPrice.toFixed(2)}/yr`;
                } else {
                  priceDisplay = 'Free';
                }
                
                const suffix = pricingModel === 'per_user' ? '/user' : '';
                return (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.name} - {priceDisplay}{suffix}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Billing Interval</InputLabel>
            <Select
              value={giftBillingInterval}
              label="Billing Interval"
              onChange={(e) => setGiftBillingInterval(e.target.value as 'month' | 'year')}
            >
              <MenuItem value="month">Monthly</MenuItem>
              <MenuItem value="year">Yearly</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGiftPackageDialog(false)}>Cancel</Button>
          <Button onClick={handleGiftPackage} variant="contained" color="success">
            Gift Package
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to cancel this subscription?
          </Alert>
          <FormControlLabel
            control={
              <Checkbox
                checked={cancelImmediately}
                onChange={(e) => setCancelImmediately(e.target.checked)}
              />
            }
            label="Cancel immediately (otherwise cancels at period end)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog(false)}>Cancel</Button>
          <Button onClick={handleCancelSubscription} variant="contained" color="error">
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Collect Payment Dialog */}
      <Dialog open={collectPaymentDialog} onClose={() => setCollectPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Collect Payment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Amount ($)"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            sx={{ mt: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={paymentDescription}
            onChange={(e) => setPaymentDescription(e.target.value)}
            sx={{ mt: 2 }}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handleCollectPayment} variant="contained">
            Create Invoice
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
