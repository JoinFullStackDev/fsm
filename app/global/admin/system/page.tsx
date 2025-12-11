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
  Chat as ChatIcon,
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
  
  // Stripe key states - secret keys are encrypted in DB and not returned to client
  // We only store new keys being entered (for update), not existing keys
  const [testSecretKey, setTestSecretKey] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [livePublishableKey, setLivePublishableKey] = useState('');
  const [hasTestSecretKey, setHasTestSecretKey] = useState(false);
  const [hasLiveSecretKey, setHasLiveSecretKey] = useState(false);
  const [showTestSecret, setShowTestSecret] = useState(false);
  const [showTestPublishable, setShowTestPublishable] = useState(false);
  const [showLiveSecret, setShowLiveSecret] = useState(false);
  const [showLivePublishable, setShowLivePublishable] = useState(false);
  
  // SendGrid key states
  const [sendGridApiKey, setSendGridApiKey] = useState('');
  const [showSendGridApiKey, setShowSendGridApiKey] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  
  // Gemini AI key states - API key is encrypted in DB and not returned to client
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [geminiProjectName, setGeminiProjectName] = useState('');
  const [showGeminiApiKey, setShowGeminiApiKey] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<'success' | 'failed' | null>(null);

  // Slack integration states
  const [slackClientId, setSlackClientId] = useState('');
  const [slackClientSecret, setSlackClientSecret] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [hasSlackClientSecret, setHasSlackClientSecret] = useState(false);
  const [hasSlackSigningSecret, setHasSlackSigningSecret] = useState(false);
  const [slackEnabledForOrgs, setSlackEnabledForOrgs] = useState(true);
  const [showSlackClientSecret, setShowSlackClientSecret] = useState(false);
  const [showSlackSigningSecret, setShowSlackSigningSecret] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/global/admin/system/connections');
      if (!response.ok) {
        throw new Error('Failed to load connections');
      }
      const data = await response.json();
      setConnections(data.connections || {});
      
      // Load Stripe keys if connection exists
      // Note: Secret keys are encrypted in DB and NOT returned to client
      // We only receive boolean indicators (has_test_secret_key, has_live_secret_key)
      const stripeConnection = data.connections?.stripe;
      if (stripeConnection?.config) {
        // Secret keys - only track if configured (actual keys are never sent to client)
        setHasTestSecretKey(!!stripeConnection.config.has_test_secret_key);
        setHasLiveSecretKey(!!stripeConnection.config.has_live_secret_key);
        // Publishable keys are safe to display (they're meant to be public)
        setTestPublishableKey(stripeConnection.config.test_publishable_key || '');
        setLivePublishableKey(stripeConnection.config.live_publishable_key || '');
        // Clear any entered secret keys on reload
        setTestSecretKey('');
        setLiveSecretKey('');
      }
      
      // Load SendGrid API key status if connection exists (note: it's encrypted, so we don't show it)
      // Users will need to re-enter it if they want to change it
      const emailConnection = data.connections?.email;
      // The has_api_key flag tells us if a key is configured without exposing the actual key
      if (emailConnection?.config?.has_api_key) {
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
      
      // Load Gemini AI configuration
      try {
        const aiResponse = await fetch('/api/global/admin/system/ai');
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.gemini) {
            setHasGeminiApiKey(aiData.gemini.has_api_key || false);
            setGeminiEnabled(aiData.gemini.enabled !== false);
            setGeminiProjectName(aiData.gemini.project_name || '');
            setGeminiApiKey(''); // Clear any entered key on reload
          }
        }
      } catch (aiErr) {
        // AI config is optional, don't fail if it doesn't load
        console.error('Failed to load AI configuration:', aiErr);
      }

      // Load Slack configuration
      try {
        const slackResponse = await fetch('/api/global/admin/system/connections/slack');
        if (slackResponse.ok) {
          const slackData = await slackResponse.json();
          if (slackData.connection?.config) {
            setSlackClientId(slackData.connection.config.client_id || '');
            setHasSlackClientSecret(slackData.connection.config.has_client_secret || false);
            setHasSlackSigningSecret(slackData.connection.config.has_signing_secret || false);
            setSlackEnabledForOrgs(slackData.connection.config.enabled_for_organizations !== false);
            // Clear secret fields on reload
            setSlackClientSecret('');
            setSlackSigningSecret('');
          }
        }
      } catch (slackErr) {
        // Slack config is optional, don't fail if it doesn't load
        console.error('Failed to load Slack configuration:', slackErr);
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

  const handleSaveGeminiConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/global/admin/system/ai', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gemini_api_key: geminiApiKey.trim() || undefined,
          gemini_enabled: geminiEnabled,
          gemini_project_name: geminiProjectName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save Gemini configuration');
      }

      showSuccess('Gemini AI configuration saved successfully');
      setGeminiApiKey(''); // Clear the API key field after saving
      await loadConnections();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save Gemini configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestGeminiConnection = async (useDirectHttp = false) => {
    if (!geminiApiKey && !hasGeminiApiKey) {
      showError('Please configure a Gemini API key first');
      return;
    }

    const testKey = useDirectHttp ? 'gemini_direct' : 'gemini';
    setTesting({ ...testing, [testKey]: true });
    setGeminiTestResult(null);

    try {
      const endpoint = useDirectHttp ? '/api/admin/test-gemini-direct' : '/api/admin/test-gemini';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: geminiApiKey.trim() || undefined,
          useSavedKey: !geminiApiKey.trim() && hasGeminiApiKey,
          projectName: geminiProjectName,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showSuccess(`Gemini API connection successful${useDirectHttp ? ' (Direct HTTP)' : ' (SDK)'}!`);
        setGeminiTestResult('success');
      } else {
        showError(data.error || 'Gemini connection test failed');
        setGeminiTestResult('failed');
      }
    } catch (err) {
      showError('Gemini connection test failed');
      setGeminiTestResult('failed');
    } finally {
      setTesting({ ...testing, [testKey]: false });
    }
  };

  const handleSaveSlackConfig = async () => {
    if (!slackClientId.trim()) {
      showError('Please enter a Slack Client ID');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        client_id: slackClientId.trim(),
        enabled_for_organizations: slackEnabledForOrgs,
      };

      // Only include secrets if provided (to update)
      if (slackClientSecret.trim()) {
        body.client_secret = slackClientSecret.trim();
      }
      if (slackSigningSecret.trim()) {
        body.signing_secret = slackSigningSecret.trim();
      }

      const response = await fetch('/api/global/admin/system/connections/slack', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save Slack configuration');
      }

      showSuccess('Slack configuration saved successfully');
      // Clear secret fields after saving
      setSlackClientSecret('');
      setSlackSigningSecret('');
      await loadConnections();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save Slack configuration');
    } finally {
      setSaving(false);
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
          <Tab icon={<ChatIcon />} iconPosition="start" label="Slack" />
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
              {hasTestSecretKey && (
                <Grid item xs={12}>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Test secret key is configured. Enter a new key only if you want to update it.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Test Secret Key"
                  type={showTestSecret ? 'text' : 'password'}
                  value={testSecretKey}
                  onChange={(e) => setTestSecretKey(e.target.value)}
                  placeholder={hasTestSecretKey ? "Enter new key to update..." : "sk_test_..."}
                  helperText={hasTestSecretKey ? 'Secret key is configured. Enter a new key to update it.' : 'Enter your Stripe test secret key'}
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
              {hasLiveSecretKey && (
                <Grid item xs={12}>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Live secret key is configured. Enter a new key only if you want to update it.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Live Secret Key"
                  type={showLiveSecret ? 'text' : 'password'}
                  value={liveSecretKey}
                  onChange={(e) => setLiveSecretKey(e.target.value)}
                  placeholder={hasLiveSecretKey ? "Enter new key to update..." : "sk_live_..."}
                  helperText={hasLiveSecretKey ? 'Secret key is configured. Enter a new key to update it.' : 'Enter your Stripe live secret key'}
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
              {emailConnection?.config?.has_api_key && (
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
                  placeholder={emailConnection?.config?.has_api_key ? "Enter new key to update (or leave empty to test existing)" : "SG.xxxxxxxxxxxxx"}
                  helperText={emailConnection?.config?.has_api_key ? 'API key is configured. Enter a new key to update it, or leave empty and click "Test Connection" to test the existing key.' : 'Enter your SendGrid API key'}
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
                  disabled={testing.email || (!emailConnection?.config?.has_api_key && !sendGridApiKey?.trim())}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {testing.email ? 'Testing...' : 'Test Connection'}
                </Button>
              </Grid>
              {!emailConnection?.config?.has_api_key && (
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
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, gap: { xs: 1, md: 0 } }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Gemini AI Configuration
              </Typography>
              {geminiTestResult && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {geminiTestResult === 'success' ? (
                    <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                  ) : (
                    <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {geminiTestResult === 'success' ? 'Last test: Success' : 'Last test: Failed'}
                  </Typography>
                </Box>
              )}
            </Box>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {hasGeminiApiKey && (
                <Grid item xs={12}>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Gemini API key is configured. You can test the connection below. Enter a new key only if you want to update it.
                  </Alert>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={geminiEnabled}
                      onChange={(e) => setGeminiEnabled(e.target.checked)}
                    />
                  }
                  label="Enable Gemini AI Features"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Gemini API Key"
                  type={showGeminiApiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={hasGeminiApiKey ? "Enter new key to update..." : "AIza..."}
                  helperText={hasGeminiApiKey 
                    ? 'API key is configured. Enter a new key to update it, or leave empty and click "Test Connection" to test the existing key.'
                    : 'Enter your Gemini API key from Google AI Studio. Keys typically start with "AIza".'
                  }
                  InputProps={{
                    endAdornment: geminiApiKey && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowGeminiApiKey(!showGeminiApiKey)}
                          edge="end"
                          size="small"
                        >
                          {showGeminiApiKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Project Name (Optional)"
                  value={geminiProjectName}
                  onChange={(e) => setGeminiProjectName(e.target.value)}
                  placeholder="My Project"
                  helperText="Optional project identifier for AI context"
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveGeminiConfig}
                  disabled={saving}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestGeminiConnection(false)}
                  disabled={testing.gemini || (!geminiApiKey && !hasGeminiApiKey)}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {testing.gemini ? 'Testing...' : 'Test Connection (SDK)'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestGeminiConnection(true)}
                  disabled={testing.gemini_direct || (!geminiApiKey && !hasGeminiApiKey)}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {testing.gemini_direct ? 'Testing...' : 'Test Direct HTTP'}
                </Button>
              </Grid>

              {!hasGeminiApiKey && !geminiApiKey && (
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

      {/* Slack Tab */}
      <TabPanel value={activeTab} index={4}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, gap: { xs: 1, md: 0 } }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                  Slack Integration
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={slackEnabledForOrgs}
                      onChange={(e) => setSlackEnabledForOrgs(e.target.checked)}
                    />
                  }
                  label="Enable for Organizations"
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure your Slack app credentials to enable organizations to connect their Slack workspaces.
                Create a Slack app at{' '}
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  api.slack.com/apps
                </a>
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Client ID"
                    value={slackClientId}
                    onChange={(e) => setSlackClientId(e.target.value)}
                    placeholder="Enter your Slack Client ID"
                    helperText="Found in Basic Information > App Credentials"
                  />
                </Grid>

                {hasSlackClientSecret && (
                  <Grid item xs={12}>
                    <Alert severity="success" sx={{ mb: 1 }}>
                      Client Secret is configured. Enter a new secret only if you want to update it.
                    </Alert>
                  </Grid>
                )}

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Client Secret"
                    type={showSlackClientSecret ? 'text' : 'password'}
                    value={slackClientSecret}
                    onChange={(e) => setSlackClientSecret(e.target.value)}
                    placeholder={hasSlackClientSecret ? "Enter new secret to update..." : "Enter your Slack Client Secret"}
                    helperText={hasSlackClientSecret ? 'Secret is configured. Enter a new one to update.' : 'Found in Basic Information > App Credentials'}
                    InputProps={{
                      endAdornment: slackClientSecret && (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowSlackClientSecret(!showSlackClientSecret)}
                            edge="end"
                            size="small"
                          >
                            {showSlackClientSecret ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Signing Secret"
                    type={showSlackSigningSecret ? 'text' : 'password'}
                    value={slackSigningSecret}
                    onChange={(e) => setSlackSigningSecret(e.target.value)}
                    placeholder={hasSlackSigningSecret ? "Enter new secret to update..." : "Enter your Slack Signing Secret"}
                    helperText={hasSlackSigningSecret ? 'Secret is configured. Enter a new one to update.' : 'Found in Basic Information > App Credentials (for webhook verification)'}
                    InputProps={{
                      endAdornment: slackSigningSecret && (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowSlackSigningSecret(!showSlackSigningSecret)}
                            edge="end"
                            size="small"
                          >
                            {showSlackSigningSecret ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <strong>Required OAuth Scopes:</strong> chat:write, chat:write.public, channels:read, users:read, users:read.email
                    <br />
                    <strong>Redirect URL:</strong> {typeof window !== 'undefined' ? `${window.location.origin}/api/integrations/slack/callback` : '/api/integrations/slack/callback'}
                  </Alert>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveSlackConfig}
                    disabled={saving || !slackClientId.trim()}
                    sx={{
                      mt: 1,
                      backgroundColor: theme.palette.text.primary,
                      color: theme.palette.background.paper,
                      '&:hover': {
                        backgroundColor: theme.palette.text.secondary,
                      },
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Slack Configuration'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
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
