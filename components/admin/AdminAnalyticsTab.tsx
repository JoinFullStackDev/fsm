'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
} from '@mui/material';
import {
  People as PeopleIcon,
  FolderOpen as FolderIcon,
  Download as DownloadIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  totalProjects: number;
  totalExports: number;
  aiRequests: number;
  exportsByType: { type: string; count: number }[];
}

export default function AdminAnalyticsTab() {
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsers: 0,
    activeUsers: 0,
    newUsersThisMonth: 0,
    totalProjects: 0,
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
    try {
      // Get user stats
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, is_active, created_at');

      if (usersError) throw usersError;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const totalUsers = usersData?.length || 0;
      const activeUsers = usersData?.filter(u => u.is_active !== false).length || 0;
      const newUsersThisMonth = usersData?.filter(u => 
        new Date(u.created_at) >= startOfMonth
      ).length || 0;

      // Get project stats
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id');

      if (projectsError) throw projectsError;

      // Get export stats
      const { data: exportsData, error: exportsError } = await supabase
        .from('exports')
        .select('export_type');

      if (exportsError) throw exportsError;

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

      // Get AI usage from activity logs (if available)
      const { data: aiActivityData } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('action_type', 'ai_used');

      setAnalytics({
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        totalProjects: projectsData?.length || 0,
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
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, mb: 3 }}>
        Analytics & Reports
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main', textAlign: 'center' }}>
            <CardContent>
              <PeopleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 700 }}>
                {analytics.totalUsers}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Total Users
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '2px solid', borderColor: 'success.main', textAlign: 'center' }}>
            <CardContent>
              <PeopleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 700 }}>
                {analytics.activeUsers}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Active Users
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '2px solid', borderColor: 'info.main', textAlign: 'center' }}>
            <CardContent>
              <FolderIcon sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" sx={{ color: 'info.main', fontWeight: 700 }}>
                {analytics.totalProjects}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Total Projects
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '2px solid', borderColor: 'secondary.main', textAlign: 'center' }}>
            <CardContent>
              <DownloadIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                {analytics.totalExports}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Total Exports
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ border: '2px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'success.main' }}>
                Recent Activity
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    New Users This Month
                  </Typography>
                  <Chip label={analytics.newUsersThisMonth} size="small" color="primary" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    AI Requests
                  </Typography>
                  <Chip label={analytics.aiRequests} size="small" color="secondary" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ border: '2px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'info.main' }}>
                Exports by Type
              </Typography>
              {analytics.exportsByType.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No exports yet
                </Typography>
              ) : (
                <TableContainer component={Paper} sx={{ backgroundColor: 'transparent' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Type</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 600 }}>Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.exportsByType.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ color: 'text.primary' }}>
                            {item.type.replace('_', ' ').toUpperCase()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.primary' }}>
                            {item.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

