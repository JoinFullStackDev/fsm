'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/lib/hooks/useNotification';

export default function StripeManagementPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleTestConnection = async (mode: 'test' | 'live') => {
    setTesting(true);
    try {
      const response = await fetch(`/api/global/admin/system/connections/stripe/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        throw new Error('Connection test failed');
      }
      showSuccess(`${mode} mode connection test successful`);
    } catch (err) {
      showError(`${mode} mode connection test failed`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

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
        Stripe Management
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Test Mode
            </Typography>
            <TextField
              fullWidth
              label="Test API Key"
              type="password"
              defaultValue="sk_test_..."
              sx={{ mt: 2 }}
              disabled
            />
            <Button
              variant="outlined"
              onClick={() => handleTestConnection('test')}
              disabled={testing}
              sx={{ mt: 2 }}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Live Mode
            </Typography>
            <TextField
              fullWidth
              label="Live API Key"
              type="password"
              defaultValue="sk_live_..."
              sx={{ mt: 2 }}
              disabled
            />
            <Button
              variant="outlined"
              onClick={() => handleTestConnection('live')}
              disabled={testing}
              sx={{ mt: 2 }}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Webhook Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Webhook endpoint: {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/stripe
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

