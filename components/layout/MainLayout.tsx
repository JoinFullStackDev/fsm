'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createSupabaseClient } from '@/lib/supabaseClient';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { UserPreferences } from '@/types/project';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const preferenceRef = useRef<boolean | null>(null);

  useEffect(() => {
    const loadSidebarPreference = async () => {
      try {
        const supabase = createSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Default to collapsed on mobile, open on desktop
          setSidebarOpen(!isMobile);
          setLoading(false);
          return;
        }

        // Use API to get user data to avoid RLS recursion issues
        const userResponse = await fetch('/api/users/me');
        const userData = userResponse.ok ? await userResponse.json() : null;

        if (userData?.preferences && typeof userData.preferences === 'object') {
          const preferences = userData.preferences as UserPreferences;
          const defaultOpen = preferences.sidebar?.defaultOpen ?? true;
          preferenceRef.current = defaultOpen;
          // On mobile, always default to collapsed; on desktop, use preference
          setSidebarOpen(isMobile ? false : defaultOpen);
        } else {
          preferenceRef.current = true;
          // Default to collapsed on mobile, open on desktop
          setSidebarOpen(!isMobile);
        }
      } catch (error) {
        console.error('Error loading sidebar preference:', error);
        preferenceRef.current = true;
        // Default to collapsed on mobile, open on desktop
        setSidebarOpen(!isMobile);
      } finally {
        setLoading(false);
      }
    };

    loadSidebarPreference();
  }, [isMobile]); // Run when isMobile changes

  // Update sidebar state when mobile breakpoint changes
  useEffect(() => {
    if (!loading) {
      // On mobile, always collapse; on desktop, use stored preference
      if (isMobile) {
        setSidebarOpen(false);
      } else if (preferenceRef.current !== null) {
        setSidebarOpen(preferenceRef.current);
      }
    }
  }, [isMobile, loading]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      <TopBar onSidebarToggle={handleSidebarToggle} sidebarOpen={sidebarOpen} />
      <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 0, md: 3 },
          mt: '64px', // TopBar height
          width: { 
            xs: '100%', // Full width on mobile (sidebar overlays)
            sm: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px)` 
          },
          transition: 'width 0.3s ease',
          overflow: 'auto',
          backgroundColor: theme.palette.background.default,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

