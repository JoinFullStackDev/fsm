'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  People as PeopleIcon,
  FolderOpen as FolderIcon,
  Download as DownloadIcon,
  AutoAwesome as AIIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalTemplates: number;
  totalProjects: number;
  newUsersThisMonth: number;
  totalExports: number;
  aiRequests: number;
  exportsByType: { type: string; count: number }[];
}

export default function AdminAnalyticsTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalTemplates: 0,
    totalProjects: 0,
    newUsersThisMonth: 0,
    totalExports: 0,
    aiRequests: 0,
    exportsByType: [],
  });

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get total templates
      const { count: templateCount } = await supabase
        .from('project_templates')
        .select('*', { count: 'exact', head: true });

      // Get total projects
      const { count: projectCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      // Get active users (users who have logged in recently - last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: activeUserCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login_at', thirtyDaysAgo.toISOString());

      // Get user stats for this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: usersData } = await supabase
        .from('users')
        .select('created_at');
      
      const newUsersThisMonth = usersData?.filter(u => 
        new Date(u.created_at) >= startOfMonth
      ).length || 0;

      // Get export stats
      const { data: exportsData } = await supabase
        .from('exports')
        .select('export_type');

      const exportsByType = (exportsData || []).reduce((acc: any[], exp: any) => {
        const type = exp.export_type || 'unknown';
        const existing = acc.find(e => e.type === type);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ type, count: 1 });
        }
        return acc;
      }, []);

      // Get AI usage from activity logs
      const { data: aiActivityData } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('action_type', 'ai_used');

      const activeUserPercentage = (userCount || 0) > 0 
        ? Math.round(((activeUserCount || 0) / (userCount || 1)) * 100) 
        : 0;

      setAnalytics({
        totalUsers: userCount || 0,
        activeUsers: activeUserCount || 0,
        totalTemplates: templateCount || 0,
        totalProjects: projectCount || 0,
        newUsersThisMonth,
        totalExports: exportsData?.length || 0,
        aiRequests: aiActivityData?.length || 0,
        exportsByType,
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error"
        sx={{
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        {error}
      </Alert>
    );
  }

  const activeUserPercentage = analytics.totalUsers > 0 
    ? Math.round((analytics.activeUsers / analytics.totalUsers) * 100) 
    : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <TrendingUpIcon sx={{ color: theme.palette.text.primary, fontSize: 28 }} />
        <Typography
          variant="h5"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
          }}
        >
          Analytics & Insights
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Core Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <PeopleIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.totalUsers}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Total Users
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <PeopleIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
              <Chip
                label={`${activeUserPercentage}%`}
                size="small"
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                  fontWeight: 600,
                }}
              />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.activeUsers}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Active Users (30d)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={activeUserPercentage}
              sx={{
                mt: 2,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.palette.background.paper,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: theme.palette.text.primary,
                },
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <FolderIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.totalTemplates}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Templates
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <FolderIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.totalProjects}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Total Projects
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <PeopleIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
              <TrendingUpIcon sx={{ color: theme.palette.text.primary, fontSize: 20 }} />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.newUsersThisMonth}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              New Users This Month
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <DownloadIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
              <Chip
                label={analytics.exportsByType.length}
                size="small"
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                  fontWeight: 600,
                }}
              />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.totalExports}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Total Exports
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <AIIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
            </Box>
            <Typography variant="h3" sx={{ color: theme.palette.text.primary, fontWeight: 700, mb: 0.5 }}>
              {analytics.aiRequests}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              AI Requests
            </Typography>
          </Paper>
        </Grid>

        {/* Exports Breakdown Table */}
        {analytics.exportsByType.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif', mb: 2 }}>
                Exports by Type
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        Type
                      </TableCell>
                      <TableCell align="right" sx={{ color: theme.palette.text.secondary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        Count
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.exportsByType.map((item, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          '&:hover': {
                            backgroundColor: theme.palette.background.paper,
                          },
                          borderBottom: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <TableCell sx={{ color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}` }}>
                          {item.type.replace('_', ' ').toUpperCase()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}` }}>
                          {item.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Activity Summary */}
        <Grid item xs={12} md={analytics.exportsByType.length > 0 ? 6 : 12}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif', mb: 2 }}>
              Activity Summary
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  New Users This Month
                </Typography>
                <Chip
                  label={analytics.newUsersThisMonth}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  AI Requests
                </Typography>
                <Chip
                  label={analytics.aiRequests}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Total Exports
                </Typography>
                <Chip
                  label={analytics.totalExports}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontWeight: 600,
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
