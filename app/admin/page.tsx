'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  People as PeopleIcon,
  Palette as PaletteIcon,
  Settings as SettingsIcon,
  Api as ApiIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminThemeTab from '@/components/admin/AdminThemeTab';
import AdminApiConfigTab from '@/components/admin/AdminApiConfigTab';
import AdminSystemTab from '@/components/admin/AdminSystemTab';
import AdminAnalyticsTab from '@/components/admin/AdminAnalyticsTab';

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
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    if (role !== 'admin') {
      router.push('/dashboard');
      return;
    }
  }, [role, roleLoading, router]);

  if (roleLoading) {
    return (
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  if (role !== 'admin') {
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            Access denied. Admin role required.
          </Alert>
        </Container>
      </>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 3,
          }}
        >
          Admin Dashboard
        </Typography>

        <Paper
          sx={{
            backgroundColor: 'background.paper',
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 3,
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  color: '#B0B0B0',
                  fontWeight: 500,
                  textTransform: 'none',
                  minHeight: 72,
                  '&.Mui-selected': {
                    color: '#00E5FF',
                    fontWeight: 600,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#00E5FF',
                  height: 3,
                },
              }}
            >
              <Tab icon={<PeopleIcon />} iconPosition="start" label="Users" />
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
            <TabPanel value={activeTab} index={4}>
              <AdminAnalyticsTab />
            </TabPanel>
          </Box>
        </Paper>
      </Container>
    </>
  );
}

