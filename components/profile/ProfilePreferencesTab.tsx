'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { User, UserPreferences } from '@/types/project';

export default function ProfilePreferencesTab() {
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      email: true,
      inApp: true,
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
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Preferences
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
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
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
                    />
                  }
                  label="Email Notifications"
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
                    />
                  }
                  label="In-App Notifications"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ border: '2px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'info.main' }}>
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
                  />
                }
                label="Enable AI Suggestions"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

