'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  GitHub as GitHubIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { User } from '@/types/project';

export default function ProfileGitHubTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<User | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);

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
    setGithubConnected(!!user.github_username || !!user.github_access_token);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleConnectGitHub = () => {
    // TODO: Implement GitHub OAuth flow
    showError('GitHub OAuth integration coming soon!');
  };

  const handleDisconnectGitHub = async () => {
    if (!profile) return;

    try {
      const updateData: any = {
        github_username: null,
        github_access_token: null,
      };
      
      // Only include updated_at if the column exists (will be added via migration)
      // For now, we'll let the database trigger handle it if it exists
      
      const { data: updatedData, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        console.error('[Profile GitHub] Disconnect error:', error);
        console.error('[Profile GitHub] Update data:', updateData);
        showError('Failed to disconnect GitHub: ' + error.message);
        return;
      }

      if (!updatedData) {
        console.error('[Profile GitHub] Update returned no data');
        showError('Failed to disconnect GitHub: Update returned no data. Check RLS policies.');
        return;
      }

      console.log('[Profile GitHub] Successfully updated:', updatedData);
      showSuccess('GitHub disconnected successfully');
      await loadProfile();
    } catch (err) {
      console.error('[Profile GitHub] Disconnect error:', err);
      showError('Failed to disconnect GitHub: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
      <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 3 }}>
        GitHub Integration
      </Typography>

      <Box
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        {githubConnected ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 32 }} />
              <Typography variant="h6" sx={{ color: '#4CAF50' }}>
                GitHub Connected
              </Typography>
            </Box>
            {profile?.github_username && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                  Username:
                </Typography>
                <Chip
                  icon={<GitHubIcon />}
                  label={profile.github_username}
                  sx={{
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
              </Box>
            )}
            <Button
              variant="outlined"
              onClick={handleDisconnectGitHub}
              sx={{
                mt: 2,
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Disconnect GitHub
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Connect your GitHub account to display your repositories and activity.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<GitHubIcon />}
              onClick={handleConnectGitHub}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Connect GitHub
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

