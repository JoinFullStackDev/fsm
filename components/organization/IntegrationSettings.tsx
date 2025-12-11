'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import SlackConfigDialog from './SlackConfigDialog';

interface SlackConfig {
  featureEnabled: boolean;
  slackAppConfigured: boolean;
  slackEnabled: boolean;
  connected: boolean;
  integration: {
    teamId: string;
    teamName: string;
    config: Record<string, unknown>;
  } | null;
}

export default function IntegrationSettings() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { features } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [slackConfig, setSlackConfig] = useState<SlackConfig | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const loadSlackConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/slack/config');
      if (response.ok) {
        const data = await response.json();
        setSlackConfig(data);
      }
    } catch (error) {
      console.error('Error loading Slack config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlackConfig();
  }, [loadSlackConfig]);

  // Check for OAuth callback success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackSuccess = params.get('slack_success');
    const slackError = params.get('slack_error');
    const slackTeam = params.get('slack_team');

    if (slackSuccess === 'true') {
      showSuccess(`Successfully connected to Slack workspace${slackTeam ? `: ${slackTeam}` : ''}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      loadSlackConfig();
    } else if (slackError) {
      const errorMessages: Record<string, string> = {
        access_denied: 'You denied the Slack authorization request',
        missing_parameters: 'Missing required parameters',
        invalid_state: 'Invalid or expired authorization state',
        not_authenticated: 'You must be logged in to connect Slack',
        admin_required: 'Only organization admins can connect Slack',
        token_exchange_failed: 'Failed to connect to Slack. Please try again.',
        database_error: 'Failed to save Slack connection. Please try again.',
        unknown_error: 'An unexpected error occurred. Please try again.',
      };
      showError(errorMessages[slackError] || `Slack connection error: ${slackError}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showSuccess, showError, loadSlackConfig]);

  const handleConnectSlack = () => {
    // Redirect to OAuth authorize endpoint
    window.location.href = '/api/integrations/slack/authorize';
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Are you sure you want to disconnect Slack? This will stop all Slack notifications.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Slack');
      }

      showSuccess('Slack disconnected successfully');
      loadSlackConfig();
    } catch (error) {
      showError('Failed to disconnect Slack');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOpenConfig = () => {
    setConfigDialogOpen(true);
  };

  const handleCloseConfig = () => {
    setConfigDialogOpen(false);
    loadSlackConfig();
  };

  if (loading) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  // Check if Slack integration feature is enabled for this organization
  const slackFeatureEnabled = features?.slack_integration_enabled === true;

  return (
    <>
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
            Integrations
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={loadSlackConfig} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {!slackFeatureEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Slack integration is not included in your current plan. Contact your administrator to enable this feature.
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Slack Integration Card */}
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                opacity: slackFeatureEnabled ? 1 : 0.6,
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Box
                  component="img"
                  src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png"
                  alt="Slack"
                  sx={{ width: 24, height: 24 }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Typography variant="subtitle1" fontWeight={600}>
                  Slack
                </Typography>
                {slackConfig?.connected && (
                  <Chip
                    label="Connected"
                    color="success"
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                )}
              </Box>

              <Typography variant="body2" color="text.secondary" mb={2}>
                Receive notifications and send messages to your Slack workspace.
              </Typography>

              {!slackConfig?.slackAppConfigured && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Slack integration has not been configured by the system administrator.
                </Alert>
              )}

              {!slackConfig?.slackEnabled && slackConfig?.slackAppConfigured && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Slack integration is currently disabled by the system administrator.
                </Alert>
              )}

              {slackConfig?.connected && slackConfig.integration && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Connected to:{' '}
                    <strong>{slackConfig.integration.teamName}</strong>
                  </Typography>
                </Box>
              )}

              <Box display="flex" gap={1} flexWrap="wrap">
                {slackConfig?.connected ? (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SettingsIcon />}
                      onClick={handleOpenConfig}
                      disabled={!slackFeatureEnabled}
                    >
                      Configure
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<LinkOffIcon />}
                      onClick={handleDisconnectSlack}
                      disabled={disconnecting || !slackFeatureEnabled}
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<LinkIcon />}
                    onClick={handleConnectSlack}
                    disabled={
                      !slackFeatureEnabled ||
                      !slackConfig?.slackAppConfigured ||
                      !slackConfig?.slackEnabled
                    }
                    sx={{
                      backgroundColor: '#4A154B', // Slack brand color
                      '&:hover': {
                        backgroundColor: '#3C1040',
                      },
                    }}
                  >
                    Connect to Slack
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Placeholder for future integrations */}
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                opacity: 0.5,
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  More Integrations
                </Typography>
                <Chip label="Coming Soon" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Microsoft Teams, Discord, and more integrations are coming soon.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* Slack Configuration Dialog */}
      <SlackConfigDialog
        open={configDialogOpen}
        onClose={handleCloseConfig}
        currentConfig={slackConfig?.integration?.config || {}}
      />
    </>
  );
}
