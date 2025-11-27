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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CheckCircle as CheckCircleIcon, Error as ErrorIcon, Visibility, VisibilityOff, Save as SaveIcon } from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';

export default function SystemSettingsPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [connections, setConnections] = useState<Record<string, any>>({});
  
  // Stripe key states
  const [testSecretKey, setTestSecretKey] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [livePublishableKey, setLivePublishableKey] = useState('');
  const [showTestSecret, setShowTestSecret] = useState(false);
  const [showTestPublishable, setShowTestPublishable] = useState(false);
  const [showLiveSecret, setShowLiveSecret] = useState(false);
  const [showLivePublishable, setShowLivePublishable] = useState(false);

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


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const stripeConnection = connections.stripe;
  const stripeStatus = stripeConnection?.last_test_status;

  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        System Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveStripeKeys}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Keys'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestConnection('test')}
                  disabled={testing.test}
                >
                  {testing.test ? 'Testing...' : 'Test Connection (Test Mode)'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTestConnection('live')}
                  disabled={testing.live}
                >
                  {testing.live ? 'Testing...' : 'Test Connection (Live Mode)'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Email Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Email service configuration coming soon...
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              AI Service Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              AI service configuration coming soon...
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Storage Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Storage configuration coming soon...
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
