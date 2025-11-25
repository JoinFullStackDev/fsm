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
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            {error}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 3,
          }}
        >
          Profile
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
    </>
  );
}
