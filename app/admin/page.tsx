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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  People as PeopleIcon,
  Palette as PaletteIcon,
  Settings as SettingsIcon,
  Api as ApiIcon,
  Analytics as AnalyticsIcon,
  Business as BusinessIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminThemeTab from '@/components/admin/AdminThemeTab';
import AdminApiConfigTab from '@/components/admin/AdminApiConfigTab';
import AdminSystemTab from '@/components/admin/AdminSystemTab';
import AdminAnalyticsTab from '@/components/admin/AdminAnalyticsTab';
import AdminOrganizationsTab from '@/components/admin/AdminOrganizationsTab';
import AdminApiKeysTab from '@/components/admin/AdminApiKeysTab';

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
  const { role, isSuperAdmin, loading: roleLoading } = useRole();
  // Initialize activeTab: 0 for admin (Users), 1 for PM (Theme)
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTemplates: 0,
    totalProjects: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

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

  

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    // Only allow admins with super_admin flag to access admin page
    if (role !== 'admin' || !isSuperAdmin) {
      router.push('/dashboard');
      return;
    }

    if (role === 'admin' && isSuperAdmin) {
      loadStats();
    }
  }, [role, isSuperAdmin, roleLoading, router, loadStats]);

  if (roleLoading || loadingStats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }


  if (role !== 'admin' || !isSuperAdmin) {
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
          Access denied. Super admin access required.
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
            />
            <Tab icon={<BusinessIcon />} iconPosition="start" label="Organizations" />
            <Tab icon={<VpnKeyIcon />} iconPosition="start" label="API Keys" />
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
            <AdminOrganizationsTab />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <AdminApiKeysTab />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <AdminThemeTab />
          </TabPanel>
          <TabPanel value={activeTab} index={4}>
            <AdminApiConfigTab />
          </TabPanel>
          <TabPanel value={activeTab} index={5}>
            <AdminSystemTab />
          </TabPanel>
          <TabPanel value={activeTab} index={6}>
            <AdminAnalyticsTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

