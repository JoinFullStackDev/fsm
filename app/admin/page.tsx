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
  Analytics as AnalyticsIcon,
  VpnKey as VpnKeyIcon,
  CreditCard as CreditCardIcon,
  Security as SecurityIcon,
  Groups as GroupsIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminRolesTab from '@/components/admin/AdminRolesTab';
import AdminThemeTab from '@/components/admin/AdminThemeTab';
import AdminAnalyticsTab from '@/components/admin/AdminAnalyticsTab';
import AdminApiKeysTab from '@/components/admin/AdminApiKeysTab';
import AdminSubscriptionTab from '@/components/admin/AdminSubscriptionTab';
import AdminTeamsTab from '@/components/admin/AdminTeamsTab';
import IntegrationSettings from '@/components/organization/IntegrationSettings';

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
  const { role, isSuperAdmin, isCompanyAdmin, loading: roleLoading } = useRole();
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
      // Get current user's organization via API to avoid RLS recursion
      const userResponse = await fetch('/api/users/me');
      if (!userResponse.ok) return;
      
      const currentUser = await userResponse.json();
      const orgId = currentUser?.organization_id;

      // Use API route to get counts (avoids RLS recursion)
      const [usageResponse, usersResponse] = await Promise.all([
        fetch('/api/organization/usage'),
        fetch('/api/admin/users'),
      ]);

      let userCount = 0;
      let templateCount = 0;
      let projectCount = 0;
      let activeUserCount = 0;

      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        userCount = usageData.users || 0;
        templateCount = usageData.templates || 0;
        projectCount = usageData.projects || 0;
      }

      // Get active users count (users who have logged in recently - last 30 days)
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeUsers = (usersData.users || []).filter((u: any) => 
          u.last_login_at && new Date(u.last_login_at) >= thirtyDaysAgo
        );
        activeUserCount = activeUsers.length;
      }

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
  }, []);

  

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
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3, gap: { xs: 2, md: 0 } }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.25rem', md: '1.5rem' },
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
            sx={{ ml: { xs: 0, md: 2 } }}
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
          overflow: 'visible',
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons={true}
            allowScrollButtonsMobile
            sx={{
              width: '100%',
              '& .MuiTab-root': {
                color: theme.palette.text.secondary,
                fontWeight: 500,
                textTransform: 'none',
                minHeight: { xs: 64, md: 72 },
                fontSize: { xs: '0.75rem', md: '0.875rem' },
                padding: { xs: '12px 16px', md: '12px 24px' },
                '&.Mui-selected': {
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: theme.palette.text.primary,
                height: 2,
              },
              '& .MuiTabs-scrollButtons': {
                display: { xs: 'flex', md: 'flex' },
                width: { xs: 40, md: 48 },
                flexShrink: 0,
                zIndex: 1,
                position: 'relative',
                '&.Mui-disabled': {
                  opacity: 0.3,
                },
                '&:not(.Mui-disabled)': {
                  opacity: 1,
                },
              },
            }}
          >
            <Tab 
              icon={<PeopleIcon />} 
              iconPosition="start" 
              label="Users"
            />
            {isCompanyAdmin && (
              <Tab icon={<SecurityIcon />} iconPosition="start" label="Roles" />
            )}
            {isCompanyAdmin && (
              <Tab icon={<GroupsIcon />} iconPosition="start" label="Teams" />
            )}
            {showApiKeysTab && (
              <Tab icon={<VpnKeyIcon />} iconPosition="start" label="API Keys" />
            )}
            <Tab icon={<PaletteIcon />} iconPosition="start" label="Theme" />
            <Tab icon={<CreditCardIcon />} iconPosition="start" label="Subscription" />
            <Tab icon={<LinkIcon />} iconPosition="start" label="Integrations" />
            <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          {/* Tab 0: Users (always shown) */}
          <TabPanel value={activeTab} index={0}>
            <AdminUsersTab />
          </TabPanel>
          
          {/* Tab 1: Roles (company admin only) */}
          {isCompanyAdmin && (
            <TabPanel value={activeTab} index={1}>
              <AdminRolesTab />
            </TabPanel>
          )}
          
          {/* Tab 2: Teams (company admin only) */}
          {isCompanyAdmin && (
            <TabPanel value={activeTab} index={2}>
              <AdminTeamsTab />
            </TabPanel>
          )}
          
          {/* Tab index calculation: 3 if Roles+Teams shown, 1 if not (API Keys conditional) */}
          {showApiKeysTab && (
            <TabPanel value={activeTab} index={isCompanyAdmin ? 3 : 1}>
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
          
          {/* Tab index calculation: Theme tab (after Users, Roles, Teams, API Keys) */}
          <TabPanel value={activeTab} index={isCompanyAdmin ? (showApiKeysTab ? 4 : 3) : (showApiKeysTab ? 2 : 1)}>
            <AdminThemeTab />
          </TabPanel>
          
          {/* Tab index calculation: Subscription tab */}
          <TabPanel value={activeTab} index={isCompanyAdmin ? (showApiKeysTab ? 5 : 4) : (showApiKeysTab ? 3 : 2)}>
            <AdminSubscriptionTab />
          </TabPanel>
          
          {/* Tab index calculation: Integrations tab */}
          <TabPanel value={activeTab} index={isCompanyAdmin ? (showApiKeysTab ? 6 : 5) : (showApiKeysTab ? 4 : 3)}>
            <IntegrationSettings />
          </TabPanel>
          
          {/* Tab index calculation: Analytics */}
          <TabPanel value={activeTab} index={isCompanyAdmin ? (showApiKeysTab ? 7 : 6) : (showApiKeysTab ? 5 : 4)}>
            <AdminAnalyticsTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

