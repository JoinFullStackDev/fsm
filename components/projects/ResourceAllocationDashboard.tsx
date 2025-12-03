'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  useTheme,
} from '@mui/material';
import WorkloadIndicator from './WorkloadIndicator';
import type { UserWorkloadSummary } from '@/types/project';

interface ResourceAllocationDashboardProps {
  projectId?: string;
  userIds?: string[]; // Optional: filter by specific users
  userMap?: Map<string, { name: string | null; email: string }>; // Optional: user info map
}

export default function ResourceAllocationDashboard({
  projectId,
  userIds,
  userMap,
}: ResourceAllocationDashboardProps) {
  const theme = useTheme();
  const [workloads, setWorkloads] = useState<UserWorkloadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'over_allocated' | 'high_utilization' | 'available'>('all');

  useEffect(() => {
    loadWorkloads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, startDate, endDate, userIds]);

  const loadWorkloads = async () => {
    setLoading(true);
    setError(null);

    try {
      const targetUserIds = userIds || [];
      
      let response;
      if (targetUserIds.length > 0) {
        // Use batch endpoint for multiple users
        response = await fetch('/api/resource-allocation/workload/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: targetUserIds,
            start_date: startDate,
            end_date: endDate,
          }),
        });
      } else {
        // Get all users' workloads
        response = await fetch(
          `/api/resource-allocation/workload?start_date=${startDate}&end_date=${endDate}`
        );
      }

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load workload data');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setWorkloads(data.workloads || []);
    } catch (err) {
      setError('Failed to load workload data');
      console.error('Error loading workloads:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkloads = workloads.filter((workload) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'over_allocated') return workload.is_over_allocated;
    if (filterStatus === 'high_utilization') return workload.utilization_percentage >= 80 && !workload.is_over_allocated;
    if (filterStatus === 'available') return workload.utilization_percentage < 80;
    return true;
  });

  const getStatusColor = (workload: UserWorkloadSummary): 'success' | 'warning' | 'error' | 'default' => {
    if (workload.is_over_allocated) return 'error';
    if (workload.utilization_percentage >= 80) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Resource Allocation Dashboard
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: startDate }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter</InputLabel>
                <Select
                  value={filterStatus}
                  label="Filter"
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <MenuItem value="all">All Users</MenuItem>
                  <MenuItem value="over_allocated">Over-allocated</MenuItem>
                  <MenuItem value="high_utilization">High Utilization (80%+)</MenuItem>
                  <MenuItem value="available">Available Capacity</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

            {filteredWorkloads.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No workload data found for the selected criteria.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Capacity</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Allocated</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Available</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Utilization</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredWorkloads.map((workload) => {
                      const userInfo = userMap?.get(workload.user_id);
                      return (
                      <TableRow key={workload.user_id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {userInfo?.name || userInfo?.email || `User ${workload.user_id.slice(0, 8)}...`}
                          </Typography>
                          {workload.projects && workload.projects.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {workload.projects.length} project{workload.projects.length !== 1 ? 's' : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {workload.max_hours_per_week} hrs/week
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body2"
                            sx={{ 
                              fontWeight: workload.is_over_allocated ? 'bold' : 'normal',
                              color: workload.is_over_allocated ? 'error.main' : 'text.primary',
                            }}
                          >
                            {workload.allocated_hours_per_week.toFixed(1)} hrs/week
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {workload.available_hours_per_week.toFixed(1)} hrs/week
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <WorkloadIndicator workload={workload} size="medium" showLabel={true} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={workload.is_over_allocated ? 'Over-allocated' : workload.utilization_percentage >= 80 ? 'High' : 'Normal'}
                            color={getStatusColor(workload)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        {workloads.length > 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4">
                    {workloads.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Over-allocated
                  </Typography>
                  <Typography variant="h4" color="error">
                    {workloads.filter(w => w.is_over_allocated).length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Average Utilization
                  </Typography>
                  <Typography variant="h4">
                    {workloads.length > 0
                      ? (workloads.reduce((sum, w) => sum + w.utilization_percentage, 0) / workloads.length).toFixed(1)
                      : 0}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
  );
}

