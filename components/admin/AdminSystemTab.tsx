'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { AdminSetting } from '@/types/project';

export default function AdminSystemTab() {
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [appName, setAppName] = useState('FullStack Method™ App');
  const [emailSignupSubject, setEmailSignupSubject] = useState('Welcome to FullStack Method™');
  const [emailSignupBody, setEmailSignupBody] = useState('Welcome!');

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', ['system_maintenance_mode', 'system_app_name', 'email_signup_template']);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const settings = data as AdminSetting[];
    const maintenance = settings.find(s => s.key === 'system_maintenance_mode');
    const appNameSetting = settings.find(s => s.key === 'system_app_name');
    const emailTemplate = settings.find(s => s.key === 'email_signup_template');

    if (maintenance?.value !== undefined) {
      setMaintenanceMode(Boolean(maintenance.value));
    }
    if (appNameSetting?.value) {
      setAppName(String(appNameSetting.value));
    }
    if (emailTemplate?.value && typeof emailTemplate.value === 'object') {
      const template = emailTemplate.value as { subject?: string; body?: string };
      setEmailSignupSubject(template.subject || 'Welcome to FullStack Method™');
      setEmailSignupBody(template.body || 'Welcome!');
    }

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
      {
        key: 'system_maintenance_mode',
        value: maintenanceMode,
        category: 'system' as const,
        updated_by: userData?.id,
      },
      {
        key: 'system_app_name',
        value: appName,
        category: 'system' as const,
        updated_by: userData?.id,
      },
      {
        key: 'email_signup_template',
        value: { subject: emailSignupSubject, body: emailSignupBody },
        category: 'email' as const,
        updated_by: userData?.id,
      },
    ];

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('admin_settings')
        .upsert({
          key: update.key,
          value: update.value,
          category: update.category,
          updated_by: update.updated_by,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (updateError) {
        showError('Failed to save settings: ' + updateError.message);
        setSaving(false);
        return;
      }
    }

    showSuccess('System settings saved successfully!');
    setSaving(false);
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
          System Settings
        </Typography>
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
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card sx={{ border: '2px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'warning.main' }}>
                Maintenance Mode
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: 'warning.main',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'warning.main',
                      },
                    }}
                  />
                }
                label={maintenanceMode ? 'Maintenance mode is ON' : 'Maintenance mode is OFF'}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                When enabled, only admins can access the application.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Application Configuration
              </Typography>
              <TextField
                label="Application Name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ border: '2px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'info.main' }}>
                Email Templates
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                Signup Welcome Email
              </Typography>
              <TextField
                label="Subject"
                value={emailSignupSubject}
                onChange={(e) => setEmailSignupSubject(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Body"
                value={emailSignupBody}
                onChange={(e) => setEmailSignupBody(e.target.value)}
                fullWidth
                multiline
                rows={4}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
