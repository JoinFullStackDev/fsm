'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Send as SendIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members?: number;
}

interface NotificationSetting {
  enabled: boolean;
  channel?: string;
  channel_id?: string;
}

interface SlackIntegrationConfig {
  default_channel?: string;
  default_channel_id?: string;
  notifications: {
    task_assigned?: NotificationSetting;
    project_created?: NotificationSetting;
    comment_created?: NotificationSetting;
    workflow_triggered?: NotificationSetting;
    [key: string]: NotificationSetting | undefined;
  };
  user_mapping: {
    auto_match_by_email: boolean;
  };
}

interface SlackConfigDialogProps {
  open: boolean;
  onClose: () => void;
  currentConfig: Record<string, unknown>;
}

const NOTIFICATION_TYPES = [
  { key: 'task_assigned', label: 'Task Assigned', description: 'When a task is assigned to a user' },
  { key: 'project_created', label: 'Project Created', description: 'When a new project is created' },
  { key: 'comment_created', label: 'Comments', description: 'When comments are added to tasks' },
  { key: 'workflow_triggered', label: 'Workflow Events', description: 'When workflow actions are triggered' },
];

export default function SlackConfigDialog({
  open,
  onClose,
  currentConfig,
}: SlackConfigDialogProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [config, setConfig] = useState<SlackIntegrationConfig>({
    default_channel: '',
    default_channel_id: '',
    notifications: {
      task_assigned: { enabled: true },
      project_created: { enabled: true },
      comment_created: { enabled: false },
      workflow_triggered: { enabled: true },
    },
    user_mapping: {
      auto_match_by_email: true,
    },
  });

  // Load channels when dialog opens
  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/slack/channels');
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadChannels();
      // Initialize config from current config
      const cfg = currentConfig as unknown as SlackIntegrationConfig;
      if (cfg) {
        setConfig({
          default_channel: cfg.default_channel || '',
          default_channel_id: cfg.default_channel_id || '',
          notifications: {
            task_assigned: cfg.notifications?.task_assigned || { enabled: true },
            project_created: cfg.notifications?.project_created || { enabled: true },
            comment_created: cfg.notifications?.comment_created || { enabled: false },
            workflow_triggered: cfg.notifications?.workflow_triggered || { enabled: true },
          },
          user_mapping: {
            auto_match_by_email: cfg.user_mapping?.auto_match_by_email !== false,
          },
        });
      }
    }
  }, [open, currentConfig, loadChannels]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/integrations/slack/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      showSuccess('Slack configuration saved successfully');
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    const channel = config.default_channel_id || config.default_channel;
    if (!channel) {
      showError('Please select a default channel first');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/integrations/slack/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel }),
      });

      const data = await response.json();
      if (data.success) {
        showSuccess('Test message sent to Slack!');
      } else {
        showError(data.error || 'Failed to send test message');
      }
    } catch (error) {
      showError('Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  const handleDefaultChannelChange = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    setConfig((prev) => ({
      ...prev,
      default_channel: channel ? `#${channel.name}` : '',
      default_channel_id: channelId,
    }));
  };

  const handleNotificationToggle = (key: string, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: {
          ...prev.notifications[key],
          enabled,
        },
      },
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Configure Slack Integration
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Default Channel */}
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Default Channel
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Select the default channel for notifications. You can override this per notification type.
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 3 }}>
              <InputLabel>Default Channel</InputLabel>
              <Select
                value={config.default_channel_id || ''}
                onChange={(e) => handleDefaultChannelChange(e.target.value)}
                label="Default Channel"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {channels.map((channel) => (
                  <MenuItem key={channel.id} value={channel.id}>
                    {channel.is_private ? '🔒' : '#'} {channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box display="flex" gap={1} mb={3}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SendIcon />}
                onClick={handleTestMessage}
                disabled={testing || !config.default_channel_id}
              >
                {testing ? 'Sending...' : 'Send Test Message'}
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Notification Types */}
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Notification Types
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Choose which notifications to send to Slack.
            </Typography>

            <Grid container spacing={1}>
              {NOTIFICATION_TYPES.map((type) => (
                <Grid item xs={12} key={type.key}>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    py={1}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {type.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {type.description}
                      </Typography>
                    </Box>
                    <Switch
                      checked={config.notifications[type.key]?.enabled || false}
                      onChange={(e) => handleNotificationToggle(type.key, e.target.checked)}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* User Mapping */}
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              User Mapping
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={config.user_mapping.auto_match_by_email}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      user_mapping: {
                        ...prev.user_mapping,
                        auto_match_by_email: e.target.checked,
                      },
                    }))
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Auto-match users by email
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically mention Slack users when their email matches FSM users
                  </Typography>
                </Box>
              }
            />

            {channels.length === 0 && !loading && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No channels found. Make sure the Slack bot has been added to at least one channel.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.paper,
            '&:hover': {
              backgroundColor: theme.palette.text.secondary,
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
