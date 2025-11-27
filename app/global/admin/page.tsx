'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  totalRevenue: number;
  activeSubscriptions: number;
  systemHealth: 'healthy' | 'warning' | 'error';
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export default function GlobalAdminDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/global/admin/dashboard');
      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats?.totalOrganizations || 0,
      icon: BusinessIcon,
      color: theme.palette.primary.main,
      action: () => router.push('/global/admin/organizations'),
    },
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: PeopleIcon,
      color: theme.palette.info.main,
    },
    {
      title: 'Total Revenue',
      value: `$${stats?.totalRevenue?.toLocaleString() || '0'}`,
      icon: MoneyIcon,
      color: theme.palette.success.main,
    },
    {
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions || 0,
      icon: CheckCircleIcon,
      color: theme.palette.success.main,
    },
  ];

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
        Super Admin Dashboard
      </Typography>

      <Grid container spacing={3}>
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  cursor: card.action ? 'pointer' : 'default',
                  '&:hover': card.action
                    ? {
                        boxShadow: theme.shadows[4],
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s',
                      }
                    : {},
                }}
                onClick={card.action}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {card.title}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600, color: card.color }}>
                        {card.value}
                      </Typography>
                    </Box>
                    <Icon sx={{ fontSize: 40, color: card.color, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              System Health
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <CheckCircleIcon
                sx={{
                  fontSize: 40,
                  color:
                    stats?.systemHealth === 'healthy'
                      ? theme.palette.success.main
                      : stats?.systemHealth === 'warning'
                      ? theme.palette.warning.main
                      : theme.palette.error.main,
                }}
              />
              <Typography variant="h5" sx={{ textTransform: 'capitalize' }}>
                {stats?.systemHealth || 'Unknown'}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<BusinessIcon />}
                onClick={() => router.push('/global/admin/organizations')}
                fullWidth
              >
                Manage Organizations
              </Button>
              <Button
                variant="outlined"
                startIcon={<TrendingUpIcon />}
                onClick={() => router.push('/global/admin/ai-usage')}
                fullWidth
              >
                View AI Usage
              </Button>
              <Button
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={() => router.push('/global/admin/system')}
                fullWidth
              >
                System Settings
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Recent Activity
            </Typography>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <List>
                {stats.recentActivity.map((activity) => (
                  <ListItem key={activity.id}>
                    <ListItemIcon>
                      <ScheduleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.description}
                      secondary={new Date(activity.timestamp).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                No recent activity
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

