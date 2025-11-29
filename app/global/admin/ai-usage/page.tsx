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
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/lib/hooks/useNotification';
import OrganizationAIDetailSlideout from '@/components/global-admin/OrganizationAIDetailSlideout';

export default function AIUsagePage() {
  const theme = useTheme();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
  const [slideoutOpen, setSlideoutOpen] = useState(false);

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
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Requests
            </Typography>
            <Typography variant="h4">{stats?.totalRequests || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Cost
            </Typography>
            <Typography variant="h4">
              ${stats?.totalCost ? stats.totalCost.toFixed(4) : '0.0000'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Characters
            </Typography>
            <Typography variant="h4">
              {stats?.totalCharacters ? stats.totalCharacters.toLocaleString() : 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Tokens
            </Typography>
            <Typography variant="h4">
              {stats?.totalTokens ? stats.totalTokens.toLocaleString() : 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Requests This Month
            </Typography>
            <Typography variant="h4">{stats?.requestsThisMonth || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Requests Today
            </Typography>
            <Typography variant="h4">{stats?.requestsToday || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Avg Response Time
            </Typography>
            <Typography variant="h4">
              {stats?.averageResponseTime ? `${stats.averageResponseTime}ms` : '0ms'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Error Rate
            </Typography>
            <Typography 
              variant="h4" 
              color={stats?.errorRate && stats.errorRate > 5 ? 'error' : 'text.primary'}
            >
              {stats?.errorRate ? `${stats.errorRate.toFixed(2)}%` : '0%'}
            </Typography>
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
                    <TableCell><strong>Organization</strong></TableCell>
                    <TableCell align="right"><strong>Total Requests</strong></TableCell>
                    <TableCell align="right"><strong>This Month</strong></TableCell>
                    <TableCell align="right"><strong>Today</strong></TableCell>
                    <TableCell align="right"><strong>Characters</strong></TableCell>
                    <TableCell align="right"><strong>Tokens</strong></TableCell>
                    <TableCell align="right"><strong>Cost</strong></TableCell>
                    <TableCell align="right"><strong>Avg Time</strong></TableCell>
                    <TableCell align="right"><strong>Errors</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats?.organizations && stats.organizations.length > 0 ? (
                    stats.organizations.map((org: any) => (
                      <TableRow
                        key={org.organization_id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedOrg({
                            id: org.organization_id,
                            name: org.organization_name,
                          });
                          setSlideoutOpen(true);
                        }}
                      >
                        <TableCell>{org.organization_name}</TableCell>
                        <TableCell align="right">{org.total_requests || 0}</TableCell>
                        <TableCell align="right">{org.requests_this_month || 0}</TableCell>
                        <TableCell align="right">{org.requests_today || 0}</TableCell>
                        <TableCell align="right">
                          {org.total_characters ? org.total_characters.toLocaleString() : 0}
                        </TableCell>
                        <TableCell align="right">
                          {org.total_tokens ? org.total_tokens.toLocaleString() : 0}
                        </TableCell>
                        <TableCell align="right">
                          {org.total_cost !== null && org.total_cost !== undefined
                            ? `$${org.total_cost.toFixed(4)}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {org.average_response_time_ms
                            ? `${org.average_response_time_ms}ms`
                            : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {org.error_count > 0 ? (
                            <Chip
                              label={`${org.error_count} (${org.error_rate?.toFixed(1) || 0}%)`}
                              size="small"
                              color={org.error_rate > 5 ? 'error' : 'warning'}
                            />
                          ) : (
                            '0'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No AI usage data found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {stats?.byFeature && stats.byFeature.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Usage by Feature
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Feature</strong></TableCell>
                      <TableCell align="right"><strong>Requests</strong></TableCell>
                      <TableCell align="right"><strong>Characters</strong></TableCell>
                      <TableCell align="right"><strong>Tokens</strong></TableCell>
                      <TableCell align="right"><strong>Cost</strong></TableCell>
                      <TableCell align="right"><strong>Avg Time</strong></TableCell>
                      <TableCell align="right"><strong>Errors</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.byFeature.map((feature: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{feature.feature}</TableCell>
                        <TableCell align="right">{feature.requests || 0}</TableCell>
                        <TableCell align="right">
                          {feature.total_characters
                            ? feature.total_characters.toLocaleString()
                            : 0}
                        </TableCell>
                        <TableCell align="right">
                          {feature.total_tokens ? feature.total_tokens.toLocaleString() : 0}
                        </TableCell>
                        <TableCell align="right">
                          {feature.total_cost !== null && feature.total_cost !== undefined
                            ? `$${feature.total_cost.toFixed(4)}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {feature.average_response_time_ms
                            ? `${feature.average_response_time_ms}ms`
                            : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {feature.error_count > 0 ? (
                            <Chip
                              label={`${feature.error_count} (${feature.error_rate?.toFixed(1) || 0}%)`}
                              size="small"
                              color={feature.error_rate > 5 ? 'error' : 'warning'}
                            />
                          ) : (
                            '0'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Organization Detail Slideout */}
      <OrganizationAIDetailSlideout
        open={slideoutOpen}
        organizationId={selectedOrg?.id || null}
        organizationName={selectedOrg?.name || null}
        onClose={() => {
          setSlideoutOpen(false);
          setSelectedOrg(null);
        }}
      />
    </Box>
  );
}

