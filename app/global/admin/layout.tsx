'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Settings as SettingsIcon,
  AutoAwesome as AIIcon,
  AccountBalance as StripeIcon,
  Security as SecurityIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  MenuBook as MenuBookIcon,
  Feedback as FeedbackIcon,
} from '@mui/icons-material';
import { useRole } from '@/lib/hooks/useRole';
import { createSupabaseClient } from '@/lib/supabaseClient';
import TopBar from '@/components/layout/TopBar';
import type { UserPreferences } from '@/types/project';

const DRAWER_WIDTH = 280;

interface GlobalAdminLayoutProps {
  children: React.ReactNode;
}

export default function GlobalAdminLayout({ children }: GlobalAdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isSuperAdmin, loading: roleLoading } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const preferenceRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [isSuperAdmin, roleLoading, router]);

  useEffect(() => {
    const loadSidebarPreference = async () => {
      try {
        const supabase = createSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          // Default to collapsed on mobile, open on desktop
          setSidebarOpen(!isMobile);
          setSidebarLoading(false);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('preferences')
          .eq('auth_id', user.id)
          .single();

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
        setSidebarLoading(false);
      }
    };

    loadSidebarPreference();
  }, [isMobile]); // Run when isMobile changes

  // Update sidebar state when mobile breakpoint changes
  useEffect(() => {
    if (!sidebarLoading) {
      // On mobile, always collapse; on desktop, use stored preference
      if (isMobile) {
        setSidebarOpen(false);
      } else if (preferenceRef.current !== null) {
        setSidebarOpen(preferenceRef.current);
      }
    }
  }, [isMobile, sidebarLoading]);

  if (roleLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const navItems = [
    { path: '/global/admin', label: 'Dashboard', icon: DashboardIcon },
    { path: '/global/admin/organizations', label: 'Organizations', icon: BusinessIcon },
    { path: '/global/admin/users', label: 'Users', icon: PeopleIcon },
    { path: '/global/admin/packages', label: 'Packages', icon: InventoryIcon },
    { path: '/global/admin/system', label: 'System Settings', icon: SettingsIcon },
    { path: '/global/admin/ai-usage', label: 'AI Usage', icon: AIIcon },
    { path: '/global/admin/kb', label: 'Knowledge Base', icon: MenuBookIcon },
    { path: '/global/admin/stripe', label: 'Stripe Management', icon: StripeIcon },
    { path: '/global/admin/requests', label: 'Requests', icon: FeedbackIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/global/admin') {
      return pathname === '/global/admin';
    }
    return pathname?.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      <TopBar onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? sidebarOpen : true}
        onClose={isMobile ? () => setSidebarOpen(false) : undefined}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          width: isMobile ? DRAWER_WIDTH : (sidebarOpen ? DRAWER_WIDTH : 64),
          flexShrink: 0,
          zIndex: (theme) => isMobile ? theme.zIndex.modal : theme.zIndex.drawer,
          '& .MuiDrawer-paper': {
            width: isMobile ? DRAWER_WIDTH : (sidebarOpen ? DRAWER_WIDTH : 64),
            boxSizing: 'border-box',
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
            transition: isMobile ? 'transform 0.3s ease' : 'width 0.3s ease',
            overflowX: 'hidden',
            pt: '64px',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          {sidebarOpen ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                Super Admin
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <SecurityIcon sx={{ color: theme.palette.primary.main }} />
            </Box>
          )}
        </Box>
        <List sx={{ flexGrow: 1, pt: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <ListItem key={item.path} disablePadding>
                <Tooltip
                  title={item.label}
                  placement="right"
                  arrow
                  disableHoverListener={sidebarOpen}
                  disableFocusListener={sidebarOpen}
                  disableTouchListener={sidebarOpen}
                >
                  <ListItemButton
                    onClick={() => handleNavigate(item.path)}
                    sx={{
                      minHeight: 48,
                      justifyContent: sidebarOpen ? 'initial' : 'center',
                      px: 2.5,
                      backgroundColor: active ? theme.palette.action.selected : 'transparent',
                      '&:hover': {
                        backgroundColor: active
                          ? theme.palette.action.selected
                          : theme.palette.action.hover,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: sidebarOpen ? 3 : 'auto',
                        justifyContent: 'center',
                        color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                      }}
                    >
                      <Icon />
                    </ListItemIcon>
                    {sidebarOpen && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: active ? 600 : 400,
                          color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: '64px',
          width: {
            xs: '100%', // Full width on mobile (sidebar overlays)
            sm: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 64}px)`
          },
          maxWidth: '100%',
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

