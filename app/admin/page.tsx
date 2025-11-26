'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Grid,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  People as PeopleIcon,
  Palette as PaletteIcon,
  Settings as SettingsIcon,
  Api as ApiIcon,
  FolderOpen as FolderIcon,
  Download as DownloadIcon,
  AutoAwesome as AIIcon,
  TrendingUp as TrendingUpIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminThemeTab from '@/components/admin/AdminThemeTab';
import AdminApiConfigTab from '@/components/admin/AdminApiConfigTab';
import AdminSystemTab from '@/components/admin/AdminSystemTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AdminPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  // Initialize activeTab: 0 for admin (Users), 1 for PM (Theme)
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTemplates: 0,
    totalProjects: 0,
  });
  const [analytics, setAnalytics] = useState({
    newUsersThisMonth: 0,
    totalExports: 0,
    aiRequests: 0,
    exportsByType: [] as { type: string; count: number }[],
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const loadStats = useCallback(async () => {
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

      setStats({
        totalUsers: userCount || 0,
        activeUsers: activeUserCount || 0,
        totalTemplates: templateCount || 0,
        totalProjects: projectCount || 0,
      });
      setLoadingStats(false);
    } catch (error) {
      console.error('Error loading admin stats:', error);
      setLoadingStats(false);
    }
  }, [supabase]);

  const loadAnalytics = useCallback(async () => {
    try {
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

      setAnalytics({
        newUsersThisMonth,
        totalExports: exportsData?.length || 0,
        aiRequests: aiActivityData?.length || 0,
        exportsByType,
      });
      setLoadingAnalytics(false);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setLoadingAnalytics(false);
    }
  }, [supabase]);
  
  // Update activeTab when role loads - PMs start on Theme tab (index 1)
  useEffect(() => {
    if (!roleLoading && role === 'pm' && activeTab === 0) {
      setActiveTab(1);
    }
  }, [role, roleLoading, activeTab]);

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    // Allow admins and PMs to access admin page
    if (role !== 'admin' && role !== 'pm') {
      router.push('/dashboard');
      return;
    }

    if (role === 'admin') {
      loadStats();
      loadAnalytics();
    }
  }, [role, roleLoading, router, loadStats, loadAnalytics]);

  if (roleLoading || loadingStats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  const activeUserPercentage = stats.totalUsers > 0 
    ? Math.round((stats.activeUsers / stats.totalUsers) * 100) 
    : 0;

  if (role !== 'admin' && role !== 'pm') {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert 
          severity="error"
          sx={{
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          Access denied. Admin or PM role required.
        </Alert>
      </Box>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        Admin Dashboard
      </Typography>

      {/* Analytics Dashboard Section */}
      <Paper
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          mb: 4,
          p: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <TrendingUpIcon sx={{ color: theme.palette.text.primary, fontSize: 28 }} />
          <Typography
            variant="h5"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
            }}
          >
            Analytics & Insights
          </Typography>
        </Box>

        {loadingAnalytics ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: theme.palette.text.primary }} />
          </Box>
        ) : (
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
                  {stats.totalUsers}
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
                  {stats.activeUsers}
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
                  {stats.totalTemplates}
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
                  {stats.totalProjects}
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
                    backgroundColor: '#4CAF50',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <PeopleIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
                  <TrendingUpIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
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
                  <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 2 }}>
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
                <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 2 }}>
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
        )}
      </Paper>

      <Paper
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: theme.palette.text.secondary,
                fontWeight: 500,
                textTransform: 'none',
                minHeight: 72,
                '&.Mui-selected': {
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: theme.palette.text.primary,
                height: 2,
              },
            }}
          >
            <Tab 
              icon={<PeopleIcon />} 
              iconPosition="start" 
              label="Users"
              disabled={role !== 'admin'}
            />
            <Tab icon={<PaletteIcon />} iconPosition="start" label="Theme" />
            <Tab icon={<ApiIcon />} iconPosition="start" label="API Config" />
            <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
            <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          <TabPanel value={activeTab} index={0}>
            <AdminUsersTab />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <AdminThemeTab />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <AdminApiConfigTab />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <AdminSystemTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

