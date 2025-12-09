'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  CheckCircle as CheckCircleIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useUser } from '@/components/providers/UserProvider';
import { useThemeMode } from '@/components/providers/ThemeContextProvider';
import { useOnboarding } from '../OnboardingProvider';
import type { UserPreferences } from '@/types/project';

interface PreferencesStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function PreferencesStep({ onComplete, onSkip }: PreferencesStepProps) {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { user, refresh } = useUser();
  const { mode: currentThemeMode, setThemeMode } = useThemeMode();
  const { saving: contextSaving } = useOnboarding();

  const [preferences, setPreferences] = useState({
    themeMode: 'dark' as 'light' | 'dark',
    emailNotifications: true,
    inAppNotifications: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if preferences have been set
  const hasPreferencesSet = Boolean(user?.preferences?.theme?.mode);

  // Load existing preferences
  useEffect(() => {
    if (user?.preferences) {
      setPreferences({
        themeMode: user.preferences.theme?.mode || 'dark',
        emailNotifications: user.preferences.notifications?.email ?? true,
        inAppNotifications: user.preferences.notifications?.inApp ?? true,
      });
    }
  }, [user?.preferences]);

  const handleThemeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'light' | 'dark' | null) => {
    if (newMode) {
      setPreferences((prev) => ({ ...prev, themeMode: newMode }));
      // Immediately apply theme for preview
      setThemeMode(newMode);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const currentPrefs = (user.preferences || {}) as UserPreferences;

      const newPreferences: UserPreferences = {
        ...currentPrefs,
        theme: {
          ...currentPrefs.theme,
          mode: preferences.themeMode,
        },
        notifications: {
          ...currentPrefs.notifications,
          email: preferences.emailNotifications,
          inApp: preferences.inAppNotifications,
        },
      };

      const { error: updateError } = await supabase
        .from('users')
        .update({
          preferences: newPreferences as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        setError('Failed to save preferences: ' + updateError.message);
        setSaving(false);
        return;
      }

      await refresh();
      onComplete();
    } catch (err) {
      setError('Failed to save preferences: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (hasPreferencesSet) {
    // Show summary view
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Preferences Set
          </Typography>
        </Box>

        <Paper
          sx={{
            p: 2,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {user?.preferences?.theme?.mode === 'dark' ? (
              <DarkModeIcon sx={{ color: theme.palette.text.primary }} />
            ) : (
              <LightModeIcon sx={{ color: theme.palette.warning.main }} />
            )}
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {user?.preferences?.theme?.mode === 'dark' ? 'Dark' : 'Light'} Mode
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NotificationsIcon sx={{ color: theme.palette.text.secondary }} />
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Email: {user?.preferences?.notifications?.email !== false ? 'On' : 'Off'} |
              In-App: {user?.preferences?.notifications?.inApp !== false ? 'On' : 'Off'}
            </Typography>
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={onSkip}
            sx={{
              borderColor: theme.palette.divider,
              color: theme.palette.text.secondary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Edit Preferences
          </Button>
          <Button
            variant="contained"
            onClick={onComplete}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.secondary,
              },
            }}
          >
            Continue
          </Button>
        </Box>
      </Box>
    );
  }

  // Show form view
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Theme Selection */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.text.secondary, mb: 2, fontWeight: 600 }}
        >
          Theme
        </Typography>
        <ToggleButtonGroup
          value={preferences.themeMode}
          exclusive
          onChange={handleThemeChange}
          sx={{
            '& .MuiToggleButton-root': {
              px: 4,
              py: 1.5,
              border: `1px solid ${theme.palette.divider}`,
              '&.Mui-selected': {
                backgroundColor: theme.palette.action.selected,
                borderColor: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            },
          }}
        >
          <ToggleButton value="light">
            <LightModeIcon sx={{ mr: 1 }} />
            Light
          </ToggleButton>
          <ToggleButton value="dark">
            <DarkModeIcon sx={{ mr: 1 }} />
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Notification Settings */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.text.secondary, mb: 2, fontWeight: 600 }}
        >
          Notifications
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.emailNotifications}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    emailNotifications: e.target.checked,
                  }))
                }
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: theme.palette.text.primary,
                    '& + .MuiSwitch-track': {
                      backgroundColor: theme.palette.text.primary,
                    },
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                Email Notifications
              </Typography>
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.inAppNotifications}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    inAppNotifications: e.target.checked,
                  }))
                }
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: theme.palette.text.primary,
                    '& + .MuiSwitch-track': {
                      backgroundColor: theme.palette.text.primary,
                    },
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                In-App Notifications
              </Typography>
            }
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={onSkip}
          disabled={saving || contextSaving}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Skip for Now
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || contextSaving}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.palette.text.secondary,
            },
          }}
        >
          {saving ? <CircularProgress size={20} /> : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  );
}

