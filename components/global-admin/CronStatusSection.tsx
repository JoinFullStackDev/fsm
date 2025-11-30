'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { Refresh as RefreshIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/lib/hooks/useNotification';
import { format } from 'date-fns';

interface CronStatus {
  statistics: {
    total: number;
    enabled: number;
    disabled: number;
    due: number;
    bySchedule: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    schedule_type: string;
    last_sent_at: string;
  }>;
  cronEndpoint: string;
  cronSecretConfigured: boolean;
}

export default function CronStatusSection() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/global/admin/system/cron-status');
      if (!response.ok) {
        throw new Error('Failed to load cron status');
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      showError('Failed to load cron status');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleTriggerCron = async () => {
    try {
      setTriggering(true);
      const response = await fetch('/api/global/admin/system/cron-status', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger cron job');
      }

      const data = await response.json();
      showSuccess(`Cron job triggered: ${data.result.processed} reports processed, ${data.result.errors} errors`);
      await loadStatus(); // Refresh status
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to trigger cron job');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!status) {
    return (
      <Alert severity="error">
        Failed to load cron status. Please try refreshing.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {status.statistics.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Subscriptions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                {status.statistics.enabled}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enabled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.warning.main }}>
                {status.statistics.due}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Due for Sending
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.error.main }}>
                {status.statistics.disabled}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Disabled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Schedule Breakdown */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Subscriptions by Schedule
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(status.statistics.bySchedule).map(([schedule, count]) => (
            <Chip
              key={schedule}
              label={`${schedule.charAt(0).toUpperCase() + schedule.slice(1)}: ${count}`}
              variant="outlined"
            />
          ))}
          {Object.keys(status.statistics.bySchedule).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No subscriptions yet
            </Typography>
          )}
        </Box>
      </Box>

      {/* Configuration Status */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Configuration
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Cron Endpoint:</Typography>
            <code style={{ backgroundColor: theme.palette.background.default, padding: '2px 6px', borderRadius: 4 }}>
              {status.cronEndpoint}
            </code>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">CRON_SECRET:</Typography>
            <Chip
              label={status.cronSecretConfigured ? 'Configured' : 'Not Set'}
              color={status.cronSecretConfigured ? 'success' : 'warning'}
              size="small"
            />
          </Box>
          {!status.cronSecretConfigured && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              CRON_SECRET is not configured. It&apos;s recommended to set this in production to secure the cron endpoint.
            </Alert>
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadStatus}
          disabled={loading}
          fullWidth={false}
          sx={{
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          Refresh Status
        </Button>
        <Button
          variant="contained"
          startIcon={triggering ? <CircularProgress size={16} /> : <PlayArrowIcon />}
          onClick={handleTriggerCron}
          disabled={triggering}
          fullWidth={false}
          sx={{
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {triggering ? 'Triggering...' : 'Trigger Cron Job (Test)'}
        </Button>
      </Box>

      {/* Recent Activity */}
      {status.recentActivity.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Recent Activity (Last 10 Reports Sent)
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Last Sent</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {status.recentActivity.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <Chip
                        label={activity.schedule_type}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(activity.last_sent_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {status.recentActivity.length === 0 && (
        <Alert severity="info">
          No reports have been sent yet. Subscriptions will be processed when the cron job runs.
        </Alert>
      )}
    </Box>
  );
}

