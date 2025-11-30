'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
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
  Person as PersonIcon,
  GitHub as GitHubIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import ProfileInfoTab from '@/components/profile/ProfileInfoTab';
import ProfileGitHubTab from '@/components/profile/ProfileGitHubTab';
import ProfilePreferencesTab from '@/components/profile/ProfilePreferencesTab';
import ProfileActivityTab from '@/components/profile/ProfileActivityTab';

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
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      setLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error) {
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
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4, px: { xs: 0, md: 3 } }}>
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
        Profile
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
            <Tab icon={<PersonIcon />} iconPosition="start" label="Profile Information" />
            <Tab icon={<GitHubIcon />} iconPosition="start" label="GitHub" />
            <Tab icon={<SettingsIcon />} iconPosition="start" label="Preferences" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="Activity" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          <TabPanel value={activeTab} index={0}>
            <ProfileInfoTab />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <ProfileGitHubTab />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <ProfilePreferencesTab />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <ProfileActivityTab />
          </TabPanel>
        </Box>
      </Paper>
    </Container>
  );
}
