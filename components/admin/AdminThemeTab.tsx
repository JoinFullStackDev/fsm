'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { AdminSetting } from '@/types/project';

interface ThemeColors {
  primary: { main: string; light: string; dark: string; contrastText?: string };
  secondary: { main: string; light: string; dark: string; contrastText?: string };
  background: { default: string; paper: string };
}

export default function AdminThemeTab() {
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeColors>({
    primary: { main: '#00E5FF', light: '#5DFFFF', dark: '#00B2CC' },
    secondary: { main: '#E91E63', light: '#FF6090', dark: '#B0003A' },
    background: { default: '#000', paper: '#000' },
  });

  useEffect(() => {
    loadTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTheme = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', ['theme_primary', 'theme_secondary', 'theme_background']);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const settings = data as AdminSetting[];
    const primary = settings.find(s => s.key === 'theme_primary')?.value || theme.primary;
    const secondary = settings.find(s => s.key === 'theme_secondary')?.value || theme.secondary;
    const background = settings.find(s => s.key === 'theme_background')?.value || theme.background;

    setTheme({ primary, secondary, background });
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showError('Not authenticated');
      setSaving(false);
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    const updates = [
      { key: 'theme_primary', value: theme.primary, updated_by: userData?.id },
      { key: 'theme_secondary', value: theme.secondary, updated_by: userData?.id },
      { key: 'theme_background', value: theme.background, updated_by: userData?.id },
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          key: update.key,
          value: update.value,
          category: 'theme',
          updated_by: update.updated_by,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) {
        showError('Failed to save theme: ' + error.message);
        setSaving(false);
        return;
      }
    }

    showSuccess('Theme saved successfully! Note: Page refresh required to see changes.');
    setSaving(false);
  };

  const handleReset = () => {
    setTheme({
      primary: { main: '#00E5FF', light: '#5DFFFF', dark: '#00B2CC' },
      secondary: { main: '#E91E63', light: '#FF6090', dark: '#B0003A' },
      background: { default: '#000', paper: '#000' },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Theme Customization
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleReset}
            variant="outlined"
            sx={{ borderColor: 'warning.main', color: 'warning.main' }}
          >
            Reset
          </Button>
          <Button
            startIcon={<SaveIcon />}
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            sx={{
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {saving ? 'Saving...' : 'Save Theme'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Primary Colors
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Primary Main"
                  type="color"
                  value={theme.primary.main}
                  onChange={(e) => setTheme({ ...theme, primary: { ...theme.primary, main: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Primary Light"
                  type="color"
                  value={theme.primary.light}
                  onChange={(e) => setTheme({ ...theme, primary: { ...theme.primary, light: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Primary Dark"
                  type="color"
                  value={theme.primary.dark}
                  onChange={(e) => setTheme({ ...theme, primary: { ...theme.primary, dark: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ border: '2px solid', borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'secondary.main' }}>
                Secondary Colors
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Secondary Main"
                  type="color"
                  value={theme.secondary.main}
                  onChange={(e) => setTheme({ ...theme, secondary: { ...theme.secondary, main: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Secondary Light"
                  type="color"
                  value={theme.secondary.light}
                  onChange={(e) => setTheme({ ...theme, secondary: { ...theme.secondary, light: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Secondary Dark"
                  type="color"
                  value={theme.secondary.dark}
                  onChange={(e) => setTheme({ ...theme, secondary: { ...theme.secondary, dark: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ border: '2px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'info.main' }}>
                Background Colors
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Default Background"
                  type="color"
                  value={theme.background.default}
                  onChange={(e) => setTheme({ ...theme, background: { ...theme.background, default: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Paper Background"
                  type="color"
                  value={theme.background.paper}
                  onChange={(e) => setTheme({ ...theme, background: { ...theme.background, paper: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.background.paper,
              border: `2px solid ${theme.primary.main}`,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.primary.main }}>
              Preview
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: theme.primary.main,
                  color: '#000',
                }}
              >
                Primary Button
              </Button>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: theme.secondary.main,
                  color: '#fff',
                }}
              >
                Secondary Button
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

