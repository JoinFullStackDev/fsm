'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  CheckCircle as CheckCircleIcon, 
  Error as ErrorIcon, 
  Visibility, 
  VisibilityOff, 
  Save as SaveIcon, 
  Refresh as RefreshIcon, 
  PlayArrow as PlayArrowIcon,
  Payment as PaymentIcon,
  Email as EmailIcon,
  Assessment as AssessmentIcon,
  SmartToy as SmartToyIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import CronStatusSection from '@/components/global-admin/CronStatusSection';

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
      id={`system-settings-tabpanel-${index}`}
      aria-labelledby={`system-settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SystemSettingsPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [connections, setConnections] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState(0);
  
  // Stripe key states
  const [testSecretKey, setTestSecretKey] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [livePublishableKey, setLivePublishableKey] = useState('');
  const [showTestSecret, setShowTestSecret] = useState(false);
  const [showTestPublishable, setShowTestPublishable] = useState(false);
  const [showLiveSecret, setShowLiveSecret] = useState(false);
  const [showLivePublishable, setShowLivePublishable] = useState(false);
  
  // SendGrid key states
  const [sendGridApiKey, setSendGridApiKey] = useState('');
  const [showSendGridApiKey, setShowSendGridApiKey] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/global/admin/system/connections');
      if (!response.ok) {
        throw new Error('Failed to load connections');
      }
      const data = await response.json();
      setConnections(data.connections || {});
      
      // Load Stripe keys if connection exists
      const stripeConnection = data.connections?.stripe;
      if (stripeConnection?.config) {
        setTestSecretKey(stripeConnection.config.test_secret_key || '');
        setTestPublishableKey(stripeConnection.config.test_publishable_key || '');
        setLiveSecretKey(stripeConnection.config.live_secret_key || '');
        setLivePublishableKey(stripeConnection.config.live_publishable_key || '');
      }
      
      // Load SendGrid API key if connection exists (note: it's encrypted, so we don't show it)
      // Users will need to re-enter it if they want to change it
      const emailConnection = data.connections?.email;
      if (emailConnection?.config?.api_key) {
        // Don't set the actual key since it's encrypted - just indicate it's configured
        setSendGridApiKey(''); // Leave empty, user needs to enter new key to update
      }
      // Load sender email from config (it's stored in plain text)
      if (emailConnection?.config?.from_email) {
        setSenderEmail(emailConnection.config.from_email);
      } else {
        setSenderEmail('');
      }
      // Load sender name from config
      if (emailConnection?.config?.sender_name) {
        setSenderName(emailConnection.config.sender_name);
      } else {
        setSenderName('');
      }
    } catch (err) {
      showError('Failed to load system connections');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleSaveStripeKeys = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/global/admin/system/connections/stripe', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_secret_key: testSecretKey || undefined,
          test_publishable_key: testPublishableKey || undefined,
          live_secret_key: liveSecretKey || undefined,
          live_publishable_key: livePublishableKey || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save Stripe keys');
      }

      showSuccess('Stripe keys saved successfully');
      loadConnections();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save Stripe keys');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (mode: 'test' | 'live') => {
    setTesting({ ...testing, [mode]: true });
    try {
      const response = await fetch('/api/global/admin/system/connections/stripe/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });
      
      if (!response.ok) {
        throw new Error('Connection test failed');
      }
      
      const data = await response.json();
      if (data.success) {
        showSuccess(`${mode === 'test' ? 'Test' : 'Live'} connection test successful`);
      } else {
        showError(data.error || 'Connection test failed');
      }
      loadConnections();
    } catch (err) {
      showError(`${mode === 'test' ? 'Test' : 'Live'} connection test failed`);
    } finally {
      setTesting({ ...testing, [mode]: false });
    }
  };

  const handleSaveSendGridKeys = async () => {
    // Allow saving if either API key or sender email is provided
    if ((!sendGridApiKey || !sendGridApiKey.trim()) && (!senderEmail || !senderEmail.trim())) {
      showError('Please enter a SendGrid API key or sender email address');
      return;
    }

    setSaving(true);
    try {
      const body: any = {};
      
      // Only include API key if provided
      if (sendGridApiKey && sendGridApiKey.trim()) {
        body.api_key = sendGridApiKey.trim();
      }
      
      // Always include sender email (even if empty, to allow clearing it)
      body.from_email = senderEmail?.trim() || null;
      // Include sender name (even if empty, to allow clearing it)
      body.sender_name = senderName?.trim() || null;

      const response = await fetch('/api/global/admin/system/connections/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save SendGrid configuration');
      }

      showSuccess('SendGrid configuration saved successfully');
      setSendGridApiKey(''); // Clear the API key field after saving
      // Wait for connections to reload before finishing
      await loadConnections();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save SendGrid configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmailConnection = async () => {
    setTesting({ ...testing, email: true });
    try {
      const response = await fetch('/api/global/admin/system/connections/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Connection test failed');
      }
      
      const data = await response.json();
      if (data.success) {
        showSuccess('SendGrid connection test successful');
      } else {
        showError(data.error || 'Connection test failed');
      }
      loadConnections();
    } catch (err) {
      showError('SendGrid connection test failed');
    } finally {
      setTesting({ ...testing, email: false });
    }
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const stripeConnection = connections.stripe;
  const stripeStatus = stripeConnection?.last_test_status;
  const emailConnection = connections.email;
  const emailStatus = emailConnection?.last_test_status;

  return (
    <Box sx={{ p: { xs: 2, md: 0 } }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontSize: { xs: '1.25rem', md: '1.75rem' },
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        System Settings
      </Typography>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons={true}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              color: theme.palette.text.secondary,
              minHeight: { xs: 64, md: 72 },
              fontSize: { xs: '0.75rem', md: '0.875rem' },
              padding: { xs: '12px 16px', md: '12px 24px' },
              '&.Mui-selected': {
                color: theme.palette.text.primary,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.text.primary,
            },
            '& .MuiTabs-scrollButtons': {
              display: { xs: 'flex', md: 'flex' },
              width: { xs: 40, md: 48 },
              flexShrink: 0,
              zIndex: 1,
              position: 'relative',
              '&.Mui-disabled': {
                opacity: 0.3,
              },
              '&:not(.Mui-disabled)': {
                opacity: 1,
              },
            },
          }}
        >
          <Tab icon={<PaymentIcon />} iconPosition="start" label="Payments" />
          <Tab icon={<EmailIcon />} iconPosition="start" label="Email" />
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Reports" />
          <Tab icon={<SmartToyIcon />} iconPosition="start" label="AI Services" />
          <Tab icon={<StorageIcon />} iconPosition="start" label="Storage" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, gap: { xs: 1, md: 0 } }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Stripe Configuration
              </Typography>
              {stripeStatus && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {stripeStatus === 'success' ? (
                    <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                  ) : stripeStatus === 'failed' ? (
                    <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    {stripeStatus === 'success' ? 'Last test: Success' : 
                     stripeStatus === 'failed' ? 'Last test: Failed' : 
                     'Not tested'}
                  </Typography>
                </Box>
              )}
            </Box>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Test Mode Keys */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: theme.palette.text.secondary }}>
                  Test Mode
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Test Secret Key"
                  type={showTestSecret ? 'text' : 'password'}
                  value={testSecretKey}
                  onChange={(e) => setTestSecretKey(e.target.value)}
                  placeholder="sk_test_..."
                  InputProps={{
                    endAdornment: testSecretKey && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowTestSecret(!showTestSecret)}
                          edge="end"
                          size="small"
                        >
                          {showTestSecret ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Test Publishable Key"
                  type={showTestPublishable ? 'text' : 'password'}
                  value={testPublishableKey}
                  onChange={(e) => setTestPublishableKey(e.target.value)}
                  placeholder="pk_test_..."
                  InputProps={{
                    endAdornment: testPublishableKey && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowTestPublishable(!showTestPublishable)}
                          edge="end"
                          size="small"
                        >
                          {showTestPublishable ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Live Mode Keys */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: theme.palette.text.secondary }}>
                  Live Mode
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Live Secret Key"
                  type={showLiveSecret ? 'text' : 'password'}
                  value={liveSecretKey}
                  onChange={(e) => setLiveSecretKey(e.target.value)}
                  placeholder="sk_live_..."
                  InputProps={{
                    endAdornment: liveSecretKey && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowLiveSecret(!showLiveSecret)}
                          edge="end"
                          size="small"
                        >
                          {showLiveSecret ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Live Publishable Key"
                  type={showLivePublishable ? 'text' : 'password'}
                  value={livePublishableKey}
                  onChange={(e) => setLivePublishableKey(e.target.value)}
                  placeholder="pk_live_..."
                  InputProps={{
                    endAdornment: livePublishableKey && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowLivePublishable(!showLivePublishable)}
                          edge="end"
                          size="small"
                        >
                          {showLivePublishable ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveStripeKeys}
                  disabled={saving}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {saving ? 'Saving...' : 'Save Keys'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestConnection('test')}
                  disabled={testing.test}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {testing.test ? 'Testing...' : 'Test Connection (Test Mode)'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestConnection('live')}
                  disabled={testing.live}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {testing.live ? 'Testing...' : 'Test Connection (Live Mode)'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
            <Typography variant="h6" gutterBottom>
              Webhook Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Webhook endpoint: {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/stripe
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              Configure this webhook endpoint in your Stripe Dashboard under Settings → Webhooks. 
              This endpoint handles subscription events, payment confirmations, and other Stripe webhooks.
            </Alert>
          </Paper>
        </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, gap: { xs: 1, md: 0 } }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Email Configuration (SendGrid)
              </Typography>
              {emailStatus && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {emailStatus === 'success' ? (
                    <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                  ) : emailStatus === 'failed' ? (
                    <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    {emailStatus === 'success' ? 'Last test: Success' : 
                     emailStatus === 'failed' ? 'Last test: Failed' : 
                     'Not tested'}
                  </Typography>
                </Box>
              )}
            </Box>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {emailConnection?.config?.api_key && (
                <Grid item xs={12}>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    SendGrid API key is configured. You can test the connection below. Enter a new key only if you want to update it.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="SendGrid API Key"
                  type={showSendGridApiKey ? 'text' : 'password'}
                  value={sendGridApiKey}
                  onChange={(e) => setSendGridApiKey(e.target.value)}
                  placeholder={emailConnection?.config?.api_key ? "Enter new key to update (or leave empty to test existing)" : "SG.xxxxxxxxxxxxx"}
                  helperText={emailConnection?.config?.api_key ? 'API key is configured. Enter a new key to update it, or leave empty and click "Test Connection" to test the existing key.' : 'Enter your SendGrid API key'}
                  InputProps={{
                    endAdornment: sendGridApiKey && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowSendGridApiKey(!showSendGridApiKey)}
                          edge="end"
                          size="small"
                        >
                          {showSendGridApiKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Sender Email Address"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="email@fsm.life"
                  helperText="This email address must be verified in your SendGrid account as a Sender Identity. This is the 'from' address used for all system emails."
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Sender Name"
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="FullStack Method™ App"
                  helperText="The friendly name displayed as the sender in email clients (e.g., 'Acme Corp via FullStack Method™ App'). If left empty, will use organization name + app name format when available."
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveSendGridKeys}
                  disabled={saving || (!sendGridApiKey?.trim() && !senderEmail?.trim())}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleTestEmailConnection}
                  disabled={testing.email || (!emailConnection?.config?.api_key && !sendGridApiKey?.trim())}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {testing.email ? 'Testing...' : 'Test Connection'}
                </Button>
              </Grid>
              {!emailConnection?.config?.api_key && (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Please save an API key first before testing the connection.
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
            <Typography variant="h6" gutterBottom>
              Dashboard Scheduled Reports
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Monitor and manage scheduled dashboard report subscriptions. The cron job must be configured at the infrastructure level (Vercel, external cron service, etc.). 
              See <code>DASHBOARD_CRON_SETUP.md</code> in the project root for setup instructions.
            </Typography>
            
            <CronStatusSection />
          </Paper>
        </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
            <Typography variant="h6" gutterBottom>
              AI Service Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              AI service configuration coming soon...
            </Typography>
          </Paper>
        </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
            <Typography variant="h6" gutterBottom>
              Storage Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Storage configuration coming soon...
            </Typography>
          </Paper>
        </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
}
