'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Save as SaveIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { AdminSetting } from '@/types/project';

export default function AdminSystemTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
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
      .in('key', ['system_maintenance_mode', 'system_push_notifications_enabled', 'system_app_name', 'email_signup_template']);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const settings = data as AdminSetting[];
    const maintenance = settings.find(s => s.key === 'system_maintenance_mode');
    const pushNotifications = settings.find(s => s.key === 'system_push_notifications_enabled');
    const appNameSetting = settings.find(s => s.key === 'system_app_name');
    const emailTemplate = settings.find(s => s.key === 'email_signup_template');

    if (maintenance?.value !== undefined) {
      setMaintenanceMode(Boolean(maintenance.value));
    }
    if (pushNotifications?.value !== undefined) {
      setPushNotificationsEnabled(Boolean(pushNotifications.value));
    } else {
      // Default to true if not set
      setPushNotificationsEnabled(true);
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
        key: 'system_push_notifications_enabled',
        value: pushNotificationsEnabled,
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
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          System Settings
        </Typography>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSave}
          variant="outlined"
          disabled={saving}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
            '&.Mui-disabled': {
              borderColor: theme.palette.divider,
              color: theme.palette.text.secondary,
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
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
              Maintenance Mode
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              }
              label={maintenanceMode ? 'Maintenance mode is ON' : 'Maintenance mode is OFF'}
              sx={{ color: theme.palette.text.primary }}
            />
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
              When enabled, only admins can access the application.
            </Typography>
          </Paper>
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
              Push Notifications
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={pushNotificationsEnabled}
                  onChange={(e) => setPushNotificationsEnabled(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              }
              label={pushNotificationsEnabled ? 'Push notifications are enabled' : 'Push notifications are disabled'}
              sx={{ color: theme.palette.text.primary }}
            />
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
              When disabled, no push notifications will be sent to any users, regardless of their individual preferences.
            </Typography>
          </Paper>
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
              Application Configuration
            </Typography>
            <TextField
              label="Application Name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              fullWidth
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
              }}
            />
          </Paper>
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
              Email Templates
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 2, color: theme.palette.text.secondary }}>
              Signup Welcome Email
            </Typography>
            <TextField
              label="Subject"
              value={emailSignupSubject}
              onChange={(e) => setEmailSignupSubject(e.target.value)}
              fullWidth
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
              }}
            />
            <TextField
              label="Body"
              value={emailSignupBody}
              onChange={(e) => setEmailSignupBody(e.target.value)}
              fullWidth
              multiline
              rows={4}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
