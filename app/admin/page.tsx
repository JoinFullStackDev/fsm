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
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  People as PeopleIcon,
  Palette as PaletteIcon,
  Settings as SettingsIcon,
  Api as ApiIcon,
  Analytics as AnalyticsIcon,
  VpnKey as VpnKeyIcon,
  CreditCard as CreditCardIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminThemeTab from '@/components/admin/AdminThemeTab';
import AdminApiConfigTab from '@/components/admin/AdminApiConfigTab';
import AdminSystemTab from '@/components/admin/AdminSystemTab';
import AdminAnalyticsTab from '@/components/admin/AdminAnalyticsTab';
import AdminApiKeysTab from '@/components/admin/AdminApiKeysTab';
import AdminSubscriptionTab from '@/components/admin/AdminSubscriptionTab';

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
  const { organization, features } = useOrganization();
  // Initialize activeTab: 0 for admin (Users), 1 for PM (Theme)
  const [activeTab, setActiveTab] = useState(0);
  const [apiKeysOverride, setApiKeysOverride] = useState(false);
  
  // Check if API Access module is enabled
  // Features from OrganizationProvider already include module_overrides merged in
  const apiAccessEnabled = features?.api_access_enabled === true;
  
  // Show API Keys tab if module is enabled OR if super admin has override enabled
  const showApiKeysTab = apiAccessEnabled || (isSuperAdmin && apiKeysOverride);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTemplates: 0,
    totalProjects: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      // Get current user's organization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: currentUser } = await supabase
        .from('users')
        .select('organization_id, is_super_admin')
        .eq('auth_id', session.user.id)
        .single();

      const orgId = currentUser?.organization_id;

      // Build queries - filter by organization unless super admin
      let userQuery = supabase.from('users').select('*', { count: 'exact', head: true });
      let templateQuery = supabase.from('project_templates').select('*', { count: 'exact', head: true });
      let projectQuery = supabase.from('projects').select('*', { count: 'exact', head: true });
      let activeUserQuery = supabase.from('users').select('*', { count: 'exact', head: true });

      // Filter by organization unless super admin
      if (orgId && !(currentUser?.is_super_admin === true)) {
        userQuery = userQuery.eq('organization_id', orgId);
        templateQuery = templateQuery.eq('organization_id', orgId);
        projectQuery = projectQuery.eq('organization_id', orgId);
        activeUserQuery = activeUserQuery.eq('organization_id', orgId);
      }

      // Get total users
      const { count: userCount } = await userQuery;

      // Get total templates
      const { count: templateCount } = await templateQuery;

      // Get total projects
      const { count: projectCount } = await projectQuery;

      // Get active users (users who have logged in recently - last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: activeUserCount } = await activeUserQuery.gte('last_login_at', thirtyDaysAgo.toISOString());

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

    // Allow organization admins and super admins to access admin page
    if (role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    if (role === 'admin') {
      loadStats();
    }
  }, [role, roleLoading, router, loadStats]);

  if (roleLoading || loadingStats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }


  if (role !== 'admin') {
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
          Access denied. Admin access required.
        </Alert>
      </Box>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Super admin override toggle for API Keys tab
  const handleApiKeysOverride = () => {
    if (!isSuperAdmin) return;
    setApiKeysOverride(!apiKeysOverride);
    // If disabling override and API Keys tab was active, switch to Users tab
    if (apiKeysOverride && activeTab === 1) {
      setActiveTab(0);
    }
  };

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Admin Dashboard
        </Typography>
        {isSuperAdmin && !apiAccessEnabled && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleApiKeysOverride}
            sx={{ ml: 2 }}
          >
            {apiKeysOverride ? 'Hide' : 'Show'} API Keys Tab
          </Button>
        )}
      </Box>


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
            {showApiKeysTab && (
              <Tab icon={<VpnKeyIcon />} iconPosition="start" label="API Keys" />
            )}
            <Tab icon={<PaletteIcon />} iconPosition="start" label="Theme" />
            <Tab icon={<CreditCardIcon />} iconPosition="start" label="Subscription" />
            {isSuperAdmin && (
              <Tab icon={<ApiIcon />} iconPosition="start" label="API Config" />
            )}
            {isSuperAdmin && (
              <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
            )}
            <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Users (always shown) */}
          <TabPanel value={activeTab} index={0}>
            <AdminUsersTab />
          </TabPanel>
          
          {/* Tab 1: API Keys (conditional - only if showApiKeysTab) */}
          {showApiKeysTab && (
            <TabPanel value={activeTab} index={1}>
              {!apiAccessEnabled && isSuperAdmin && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  API Keys tab is shown via super admin override. API Access module is currently disabled for this organization.
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setApiKeysOverride(false)}
                    >
                      Hide Tab
                    </Button>
                  </Box>
                </Alert>
              )}
              <AdminApiKeysTab />
            </TabPanel>
          )}
          
          {/* Tab index calculation: 2 if API Keys shown, 1 if not */}
          <TabPanel value={activeTab} index={showApiKeysTab ? 2 : 1}>
            <AdminThemeTab />
          </TabPanel>
          
          {/* Tab index calculation: 3 if API Keys shown, 2 if not */}
          <TabPanel value={activeTab} index={showApiKeysTab ? 3 : 2}>
            <AdminSubscriptionTab />
          </TabPanel>
          
          {/* Tab index calculation: 4 if API Keys shown, 3 if not (super admin only) */}
          {isSuperAdmin && (
            <TabPanel value={activeTab} index={showApiKeysTab ? 4 : 3}>
              <AdminApiConfigTab />
            </TabPanel>
          )}
          
          {/* Tab index calculation: 5 if API Keys shown, 4 if not (super admin only) */}
          {isSuperAdmin && (
            <TabPanel value={activeTab} index={showApiKeysTab ? 5 : 4}>
              <AdminSystemTab />
            </TabPanel>
          )}
          
          {/* Tab index calculation: 
              - If super admin: 6 if API Keys shown, 5 if not
              - If not super admin: 4 if API Keys shown, 3 if not */}
          <TabPanel value={activeTab} index={isSuperAdmin ? (showApiKeysTab ? 6 : 5) : (showApiKeysTab ? 4 : 3)}>
            <AdminAnalyticsTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

