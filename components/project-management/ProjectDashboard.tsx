'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import AISummarySheet from './AISummarySheet';

interface DashboardData {
  metrics: {
    total: number;
    completed: number;
    incomplete: number;
    overdue: number;
  };
  incompleteByPhase: Array<{ phase_number: number; phase_name: string; count: number }>;
  completedByPhase: Array<{ phase_number: number; phase_name: string; count: number }>;
  overdueByPhase: Array<{ phase_number: number; phase_name: string; count: number }>;
  tasksByStatus: Array<{ status: string; count: number }>;
  tasksByPriority: Array<{ priority: string; count: number }>;
  upcomingByAssignee: Array<{ assignee_id: string; assignee_name: string; count: number }>;
  allByAssignee: Array<{ assignee_id: string; assignee_name: string; count: number }>;
  overdueByAssignee: Array<{ assignee_id: string; assignee_name: string; count: number }>;
  completionOverTime: Array<{ date: string; completed: number; total: number }>;
}

interface ProjectDashboardProps {
  projectId: string;
  projectName: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ProjectDashboard({ projectId, projectName }: ProjectDashboardProps) {
  const theme = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);

  // Chart configuration states
  const [phaseChartType, setPhaseChartType] = useState<'incomplete' | 'completed' | 'overdue'>('incomplete');
  const [statusChartType, setStatusChartType] = useState<'status' | 'priority'>('status');
  const [assigneeChartType, setAssigneeChartType] = useState<'upcoming' | 'all' | 'overdue'>('upcoming');
  const [timeChartType, setTimeChartType] = useState<'completion' | 'creation' | 'both'>('completion');

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/dashboard`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load dashboard data');
      }
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{
          mb: 3,
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        {error}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  // Prepare chart data based on configuration
  const getPhaseChartData = () => {
    let phaseData: Array<{ phase_number: number; phase_name: string; count: number }> = [];
    
    switch (phaseChartType) {
      case 'completed':
        phaseData = data.completedByPhase;
        break;
      case 'overdue':
        phaseData = data.overdueByPhase;
        break;
      case 'incomplete':
      default:
        phaseData = data.incompleteByPhase;
        break;
    }
    
    return phaseData.map(p => ({
      name: p.phase_name,
      value: p.count,
    }));
  };

  const getStatusChartData = () => {
    if (statusChartType === 'priority') {
      return data.tasksByPriority.map(p => ({
        name: p.priority === 'none' || !p.priority ? 'No Priority' : p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
        value: p.count,
      }));
    }
    return data.tasksByStatus.map(s => ({
      name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.count,
    }));
  };

  const getAssigneeChartData = () => {
    let assigneeData: Array<{ assignee_id: string; assignee_name: string; count: number }> = [];
    
    switch (assigneeChartType) {
      case 'all':
        assigneeData = data.allByAssignee;
        break;
      case 'overdue':
        assigneeData = data.overdueByAssignee;
        break;
      case 'upcoming':
      default:
        assigneeData = data.upcomingByAssignee;
        break;
    }
    
    return assigneeData.map(a => ({
      name: a.assignee_name,
      value: a.count,
    }));
  };

  const getTimeChartData = () => {
    return data.completionOverTime.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed: d.completed,
      total: d.total,
    }));
  };

  return (
    <Box>
      {/* AI Summary Button */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => setSummarySheetOpen(true)}
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            fontWeight: 600,
            '&:hover': {
              backgroundColor: theme.palette.primary.light,
            },
          }}
        >
          AI Summary
        </Button>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Total Tasks Completed
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                {data.metrics.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Total Tasks Incomplete
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                {data.metrics.incomplete}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Total Tasks Overdue
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
                {data.metrics.overdue}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                TOTAL TASKS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {data.metrics.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Bar Chart - Incomplete Tasks by Section */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Tasks by Section
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>View</InputLabel>
                <Select
                  value={phaseChartType}
                  onChange={(e) => setPhaseChartType(e.target.value as typeof phaseChartType)}
                  label="View"
                  sx={{
                    color: theme.palette.text.primary,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                  }}
                >
                  <MenuItem value="incomplete">Incomplete</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getPhaseChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: theme.palette.text.secondary }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: theme.palette.text.secondary }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.primary,
                  }}
                />
                <Bar dataKey="value" fill={theme.palette.primary.main} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Pie Chart - Tasks by Completion Status */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Tasks by Status
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>View</InputLabel>
                <Select
                  value={statusChartType}
                  onChange={(e) => setStatusChartType(e.target.value as typeof statusChartType)}
                  label="View"
                  sx={{
                    color: theme.palette.text.primary,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                  }}
                >
                  <MenuItem value="status">Status</MenuItem>
                  <MenuItem value="priority">Priority</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getStatusChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getStatusChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.primary,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Bar Chart - Upcoming Tasks by Assignee */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Tasks by Assignee
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>View</InputLabel>
                <Select
                  value={assigneeChartType}
                  onChange={(e) => setAssigneeChartType(e.target.value as typeof assigneeChartType)}
                  label="View"
                  sx={{
                    color: theme.palette.text.primary,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                  }}
                >
                  <MenuItem value="upcoming">Upcoming</MenuItem>
                  <MenuItem value="all">All Tasks</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getAssigneeChartData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis type="number" tick={{ fill: theme.palette.text.secondary }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: theme.palette.text.secondary }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.primary,
                  }}
                />
                <Bar dataKey="value" fill={theme.palette.secondary.main} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Multi-layer Bar Chart - Task Completion Over Time */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Task Completion Over Time
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>View</InputLabel>
                <Select
                  value={timeChartType}
                  onChange={(e) => setTimeChartType(e.target.value as typeof timeChartType)}
                  label="View"
                  sx={{
                    color: theme.palette.text.primary,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                  }}
                >
                  <MenuItem value="completion">Completion</MenuItem>
                  <MenuItem value="creation">Creation</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getTimeChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: theme.palette.text.secondary }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: theme.palette.text.secondary }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.primary,
                  }}
                />
                <Legend />
                <Bar dataKey="completed" fill={theme.palette.success.main} name="Completed" />
                <Bar dataKey="total" fill={theme.palette.primary.main} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* AI Summary Sheet */}
      <AISummarySheet
        open={summarySheetOpen}
        projectId={projectId}
        projectName={projectName}
        onClose={() => setSummarySheetOpen(false)}
      />
    </Box>
  );
}

