'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/lib/hooks/useNotification';

export default function AIUsagePage() {
  const theme = useTheme();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const loadUsageStats = useCallback(async () => {
    try {
      const response = await fetch('/api/global/admin/ai-usage');
      if (!response.ok) {
        throw new Error('Failed to load AI usage');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      showError('Failed to load AI usage statistics');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        AI Usage Tracking
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Requests
            </Typography>
            <Typography variant="h4">{stats?.totalRequests || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Cost
            </Typography>
            <Typography variant="h4">${stats?.totalCost || '0.00'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Requests This Month
            </Typography>
            <Typography variant="h4">{stats?.requestsThisMonth || 0}</Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Organization Breakdown
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Total Requests</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>This Month</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">
                        AI usage tracking features coming soon...
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

