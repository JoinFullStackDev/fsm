'use client';

import {
  Box,
  Typography,
  Alert,
  Paper,
  Grid,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

export default function AdminApiConfigTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    checkSupabaseConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSupabaseConnection = async () => {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      setSupabaseStatus('error');
    } else {
      setSupabaseStatus('connected');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          API Configuration
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Alert
            severity="info"
            sx={{
              mb: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              AI Configuration has moved
            </Typography>
            <Typography variant="body2">
              Gemini AI configuration is now managed at the global level by super admins. 
              Please contact your system administrator or navigate to <strong>Global Admin → System Settings → AI Services</strong> to configure AI features.
            </Typography>
          </Alert>
        </Grid>

        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              Supabase Connection
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                Status:
              </Typography>
              {supabaseStatus === 'checking' && <CircularProgress size={20} sx={{ color: theme.palette.text.primary }} />}
              {supabaseStatus === 'connected' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#4CAF50' }}>
                  <CheckCircleIcon />
                  <Typography sx={{ color: '#4CAF50' }}>Connected</Typography>
                </Box>
              )}
              {supabaseStatus === 'error' && (
                <Typography sx={{ color: theme.palette.text.primary }}>Connection Error</Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
