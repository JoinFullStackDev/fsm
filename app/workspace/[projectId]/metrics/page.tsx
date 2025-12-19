'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container, Box, Typography, Button, Grid, Card, CardContent,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, LinearProgress,
  IconButton, Menu, MenuItem as MenuItemButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { SuccessMetric, MetricsDashboardData, CreateSuccessMetricInput } from '@/types/workspace-extended';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function MetricsPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SuccessMetric[]>([]);
  const [dashboardData, setDashboardData] = useState<MetricsDashboardData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<SuccessMetric | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; metric: SuccessMetric} | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<CreateSuccessMetricInput>>({
    metric_name: '',
    metric_type: 'kpi',
    description: '',
    target_value: undefined,
    current_value: undefined,
    unit: '',
    measurement_frequency: '',
    data_source: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [metricsRes, dashboardRes] = await Promise.all([
        fetch(`/api/workspaces/${projectId}/metrics`),
        fetch(`/api/workspaces/${projectId}/metrics/dashboard`),
      ]);

      if (metricsRes.ok && dashboardRes.ok) {
        const [metricsData, dashData] = await Promise.all([
          metricsRes.json(),
          dashboardRes.json(),
        ]);
        setMetrics(metricsData);
        setDashboardData(dashData);
      }
    } catch (err) {
      showError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (metric?: SuccessMetric) => {
    if (metric) {
      setEditingMetric(metric);
      setFormData({
        metric_name: metric.metric_name,
        metric_type: metric.metric_type,
        description: metric.description || '',
        target_value: metric.target_value || undefined,
        current_value: metric.current_value || undefined,
        unit: metric.unit || '',
        measurement_frequency: metric.measurement_frequency || '',
        data_source: metric.data_source || '',
      });
    } else {
      setEditingMetric(null);
      setFormData({
        metric_name: '',
        metric_type: 'kpi',
        description: '',
        target_value: undefined,
        current_value: undefined,
        unit: '',
        measurement_frequency: '',
        data_source: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.metric_name || !formData.metric_type) {
        showError('Metric name and type are required');
        return;
      }

      const url = editingMetric
        ? `/api/workspaces/${projectId}/metrics/${editingMetric.id}`
        : `/api/workspaces/${projectId}/metrics`;
      
      const method = editingMetric ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getCsrfHeaders(),
        body: JSON.stringify({ ...formData, workspace_id: undefined }),
      });

      if (!response.ok) throw new Error('Failed to save metric');

      showSuccess(editingMetric ? 'Metric updated' : 'Metric created');
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      showError('Failed to save metric');
    }
  };

  const handleDelete = async (metricId: string) => {
    if (!confirm('Are you sure you want to delete this metric?')) return;

    try {
      const response = await fetch(`/api/workspaces/${projectId}/metrics/${metricId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
      });

      if (!response.ok) throw new Error('Failed to delete');

      showSuccess('Metric deleted');
      await loadData();
      setMenuAnchor(null);
    } catch (err) {
      showError('Failed to delete metric');
    }
  };

  const getHealthColor = (status: string | null) => {
    switch (status) {
      case 'on_track': return theme.palette.success.main;
      case 'at_risk': return theme.palette.warning.main;
      case 'off_track': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  const getHealthLabel = (status: string | null) => {
    switch (status) {
      case 'on_track': return 'On Track';
      case 'at_risk': return 'At Risk';
      case 'off_track': return 'Off Track';
      default: return 'Not Set';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/workspace/${projectId}`)}
          sx={{ mb: 2 }}
        >
          Back to Workspace
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Success Metrics Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track KPIs and validate outcomes
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Metric
          </Button>
        </Box>
      </Box>

      {/* Dashboard Summary */}
      {dashboardData && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {dashboardData.total_metrics}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Metrics
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                  {dashboardData.metrics_on_track}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  On Track
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                  {dashboardData.metrics_at_risk}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  At Risk
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
                  {dashboardData.metrics_off_track}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Off Track
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Metrics Grid */}
      <Grid container spacing={3}>
        {metrics.map((metric) => {
          const percentage = metric.target_value && metric.current_value
            ? (metric.current_value / metric.target_value) * 100
            : 0;

          return (
            <Grid item xs={12} md={6} lg={4} key={metric.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {metric.metric_name}
                      </Typography>
                      <Chip
                        label={metric.metric_type.replace('_', ' ')}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => setMenuAnchor({ element: e.currentTarget, metric })}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {metric.current_value?.toLocaleString() || '-'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {metric.unit || ''}
                      </Typography>
                    </Box>
                    {metric.target_value && (
                      <Typography variant="body2" color="text.secondary">
                        Target: {metric.target_value.toLocaleString()} {metric.unit || ''}
                      </Typography>
                    )}
                  </Box>

                  {metric.target_value && metric.current_value && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(percentage, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: theme.palette.grey[200],
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getHealthColor(metric.health_status),
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {percentage.toFixed(1)}% of target
                      </Typography>
                    </Box>
                  )}

                  <Chip
                    label={getHealthLabel(metric.health_status)}
                    size="small"
                    sx={{
                      backgroundColor: getHealthColor(metric.health_status),
                      color: 'white',
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItemButton onClick={() => {
          if (menuAnchor) handleOpenDialog(menuAnchor.metric);
          setMenuAnchor(null);
        }}>
          Edit
        </MenuItemButton>
        <MenuItemButton onClick={() => {
          if (menuAnchor) handleDelete(menuAnchor.metric.id);
        }}>
          Delete
        </MenuItemButton>
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMetric ? 'Edit Metric' : 'Add Metric'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Metric Name"
              value={formData.metric_name}
              onChange={(e) => setFormData({ ...formData, metric_name: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Metric Type</InputLabel>
              <Select
                value={formData.metric_type}
                onChange={(e) => setFormData({ ...formData, metric_type: e.target.value as any })}
                label="Metric Type"
              >
                <MenuItem value="kpi">KPI</MenuItem>
                <MenuItem value="product_health">Product Health</MenuItem>
                <MenuItem value="business_impact">Business Impact</MenuItem>
                <MenuItem value="technical">Technical</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              label="Target Value"
              type="number"
              value={formData.target_value || ''}
              onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Current Value"
              type="number"
              value={formData.current_value || ''}
              onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Unit (e.g., %, $, users)"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              fullWidth
            />
            <TextField
              label="Data Source"
              value={formData.data_source}
              onChange={(e) => setFormData({ ...formData, data_source: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingMetric ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

