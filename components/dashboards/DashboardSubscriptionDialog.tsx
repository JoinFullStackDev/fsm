'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/lib/hooks/useNotification';
import { format } from 'date-fns';

interface Subscription {
  id: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  email: string;
  enabled: boolean;
  created_at: string;
  last_sent_at?: string | null;
}

interface DashboardSubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
}

export default function DashboardSubscriptionDialog({
  open,
  onClose,
  dashboardId,
}: DashboardSubscriptionDialogProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/subscriptions`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load subscriptions');
      }
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      showError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [dashboardId, showError]);

  useEffect(() => {
    if (open && dashboardId) {
      loadSubscriptions();
      setEmail(''); // Reset email when opening
      setScheduleType('weekly');
      setEnabled(true);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dashboardId, loadSubscriptions]);


  const handleSave = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/dashboards/${dashboardId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_type: scheduleType,
          email: email.trim(),
          enabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save subscription');
      }

      showSuccess('Subscription saved successfully');
      await loadSubscriptions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save subscription';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/dashboards/${dashboardId}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete subscription');
      }

      showSuccess('Subscription deleted successfully');
      await loadSubscriptions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete subscription';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (subscriptionId: string, currentEnabled: boolean) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/dashboards/${dashboardId}/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !currentEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      showSuccess(`Subscription ${!currentEnabled ? 'enabled' : 'disabled'}`);
      await loadSubscriptions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update subscription';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const getScheduleLabel = (type: string) => {
    switch (type) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return type;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon />
          <Typography variant="h6">Scheduled Reports</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Subscribe to receive this dashboard as a PDF report via email on a schedule.
        </Typography>

        {/* Existing Subscriptions */}
        {subscriptions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Your Subscriptions
            </Typography>
            <List sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
              {subscriptions.map((subscription, index) => (
                <Box key={subscription.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <EmailIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {subscription.email}
                          </Typography>
                          <Chip
                            label={getScheduleLabel(subscription.schedule_type)}
                            size="small"
                            icon={<ScheduleIcon />}
                            color={subscription.enabled ? 'primary' : 'default'}
                            sx={{ ml: 1 }}
                          />
                          {subscription.enabled && (
                            <Chip label="Active" size="small" color="success" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {subscription.last_sent_at && (
                            <Typography variant="caption" color="text.secondary">
                              Last sent: {format(new Date(subscription.last_sent_at), 'MMM d, yyyy h:mm a')}
                            </Typography>
                          )}
                          {!subscription.last_sent_at && (
                            <Typography variant="caption" color="text.secondary">
                              Not sent yet
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={subscription.enabled}
                              onChange={() => handleToggleEnabled(subscription.id, subscription.enabled)}
                              size="small"
                            />
                          }
                          label=""
                        />
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDelete(subscription.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* New/Edit Subscription Form */}
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          {subscriptions.length > 0 ? 'Update Subscription' : 'Create Subscription'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            helperText="Reports will be sent to this email address"
          />

          <FormControl fullWidth>
            <InputLabel>Schedule</InputLabel>
            <Select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as 'daily' | 'weekly' | 'monthly')}
              label="Schedule"
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            }
            label="Enable subscription"
          />

          <Alert severity="info" sx={{ mt: 1 }}>
            Reports are generated and sent automatically based on your schedule. 
            The first report will be sent within 24 hours of creating the subscription.
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !email || loading}
          startIcon={<EmailIcon />}
        >
          {saving ? 'Saving...' : subscriptions.length > 0 ? 'Update Subscription' : 'Create Subscription'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

