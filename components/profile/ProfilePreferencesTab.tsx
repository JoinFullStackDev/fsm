'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Save as SaveIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import type { User, UserPreferences } from '@/types/project';

export default function ProfilePreferencesTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const pushNotifications = usePushNotifications();
  const { checkSubscription, supported, subscribed, loading: pushLoading, error: pushError, permission } = pushNotifications;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      email: true,
      inApp: true,
      push: false,
    },
    theme: {
      mode: 'dark',
    },
    ai: {
      enabled: true,
    },
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();

    if (userError) {
      setLoading(false);
      return;
    }

    const user = userData as User;
    setProfile(user);
    if (user.preferences && typeof user.preferences === 'object') {
      setPreferences({
        notifications: {
          email: true,
          inApp: true,
          push: false,
        },
        theme: {
          mode: 'dark',
        },
        ai: {
          enabled: true,
        },
        ...user.preferences,
      });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Sync push subscription state with preference after profile loads
  useEffect(() => {
    if (profile && supported) {
      checkSubscription();
    }
  }, [profile, supported, checkSubscription]);

  const handlePushToggle = async (enabled: boolean) => {
    if (!supported) {
      showError('Push notifications are not supported in this browser');
      return;
    }

    if (enabled) {
      // Subscribe to push notifications
      const success = await pushNotifications.subscribe();
      if (success) {
        setPreferences({
          ...preferences,
          notifications: {
            ...preferences.notifications,
            push: true,
          },
        });
        showSuccess('Push notifications enabled!');
      } else {
        showError(pushError || 'Failed to enable push notifications');
      }
    } else {
      // Unsubscribe from push notifications
      const success = await pushNotifications.unsubscribe();
      if (success) {
        setPreferences({
          ...preferences,
          notifications: {
            ...preferences.notifications,
            push: false,
          },
        });
        showSuccess('Push notifications disabled');
      } else {
        showError(pushError || 'Failed to disable push notifications');
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const updateData: any = {
        preferences: preferences as any, // JSONB field
      };
      
      // Only include updated_at if the column exists (will be added via migration)
      // For now, we'll let the database trigger handle it if it exists
      
      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Profile Preferences] Update error:', updateError);
        console.error('[Profile Preferences] Update data:', updateData);
        showError('Failed to save preferences: ' + updateError.message);
        setSaving(false);
        return;
      }

      if (!updatedData) {
        console.error('[Profile Preferences] Update returned no data');
        showError('Failed to save preferences: Update returned no data. Check RLS policies.');
        setSaving(false);
        return;
      }

      console.log('[Profile Preferences] Successfully updated:', updatedData);
      showSuccess('Preferences saved successfully!');
      // Reload profile to get updated data
      await loadProfile();
    } catch (err) {
      console.error('[Profile Preferences] Save error:', err);
      showError('Failed to save preferences: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
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
          Preferences
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
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              Notifications
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.notifications?.email ?? true}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notifications: {
                          ...preferences.notifications,
                          email: e.target.checked,
                        },
                      })
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="Email Notifications"
                sx={{ color: theme.palette.text.primary }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.notifications?.inApp ?? true}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notifications: {
                          ...preferences.notifications,
                          inApp: e.target.checked,
                        },
                      })
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="In-App Notifications"
                sx={{ color: theme.palette.text.primary }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={
                      supported
                        ? (preferences.notifications?.push ?? false) && subscribed
                        : false
                    }
                    onChange={(e) => handlePushToggle(e.target.checked)}
                    disabled={!supported || pushLoading}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: theme.palette.text.primary }}>
                      Browser Push Notifications
                    </Typography>
                    {!supported && (
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
                        Not supported in this browser
                      </Typography>
                    )}
                    {supported && permission === 'denied' && (
                      <Typography variant="caption" sx={{ color: theme.palette.error.main, display: 'block' }}>
                        Permission denied. Please enable in browser settings.
                      </Typography>
                    )}
                    {pushError && (
                      <Typography variant="caption" sx={{ color: theme.palette.error.main, display: 'block' }}>
                        {pushError}
                      </Typography>
                    )}
                  </Box>
                }
                sx={{ color: theme.palette.text.primary }}
              />
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              AI Settings
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.ai?.enabled ?? true}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      ai: {
                        ...preferences.ai,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              }
              label="Enable AI Suggestions"
              sx={{ color: theme.palette.text.primary }}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

