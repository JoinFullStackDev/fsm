'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  RocketLaunch as RocketLaunchIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  HelpOutline as HelpIcon,
  Feedback as FeedbackIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useUser } from '@/components/providers/UserProvider';
import NotificationBell from '@/components/notifications/NotificationBell';
import NotificationDrawer from '@/components/notifications/NotificationDrawer';
import WelcomeTour from '@/components/ui/WelcomeTour';
import RequestSubmissionDialog from '@/components/layout/RequestSubmissionDialog';
import { useThemeMode } from '@/components/providers/ThemeContextProvider';
import type { User } from '@/types/project';

interface TopBarProps {
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function TopBar({ onSidebarToggle, sidebarOpen }: TopBarProps) {
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const supabase = createSupabaseClient();
  const { role, isSuperAdmin, loading: roleLoading } = useRole();
  const { features, loading: orgLoading } = useOrganization();
  const { user, loading: userLoading } = useUser();
  const { mode, toggleTheme } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [welcomeTourOpen, setWelcomeTourOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [shouldFlickerRocket, setShouldFlickerRocket] = useState(false);

  // Check if rocket icon should flicker (first 2 logins)
  useEffect(() => {
    const loginCount = parseInt(localStorage.getItem('loginCount') || '0', 10);
    if (loginCount <= 2) {
      setShouldFlickerRocket(true);
    }
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    handleMenuClose();
    router.push(path);
  };

  const handleSignOut = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('[TopBar] Sign out initiated');
    
    if (typeof window !== 'undefined') {
      // Close menu first for immediate visual feedback
      handleMenuClose();
      
      // Store success message
      sessionStorage.setItem('signout_success', 'true');
      
      // Clear all cached data immediately
      localStorage.clear();
      
      // Start signout in background (don't wait)
      supabase.auth.signOut().catch(console.error);
      
      // Redirect IMMEDIATELY - don't wait for signout
      window.location.href = '/';
    }
  };

  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: 'none',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px !important', gap: 2 }}>
        {/* Left side - Menu toggle */}
        {onSidebarToggle && (
          <IconButton
            onClick={onSidebarToggle}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
            aria-label="toggle sidebar"
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Scrolling Todo Bar - takes up center/left space */}

        {/* Right side icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!userLoading && (
            <>
              <IconButton
                onClick={toggleTheme}
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <IconButton
                onClick={() => {
                  setWelcomeTourOpen(true);
                  setShouldFlickerRocket(false); // Stop flickering once clicked
                }}
                sx={{
                  color: shouldFlickerRocket ? theme.palette.primary.main : theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  ...(shouldFlickerRocket && {
                    animation: 'rocketFlicker 1.5s ease-in-out infinite',
                    '@keyframes rocketFlicker': {
                      '0%, 100%': {
                        opacity: 1,
                        transform: 'scale(1)',
                        color: theme.palette.primary.main,
                      },
                      '50%': {
                        opacity: 0.5,
                        transform: 'scale(1.15)',
                        color: theme.palette.warning.main,
                      },
                    },
                  }),
                }}
                title="Welcome Tour"
              >
                <RocketLaunchIcon />
              </IconButton>
              <IconButton
                onClick={() => setRequestDialogOpen(true)}
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                title="Submit Feature Request or Bug Report"
              >
                <FeedbackIcon />
              </IconButton>
              {!orgLoading && !roleLoading && (features?.knowledge_base_enabled === true || isSuperAdmin) && (
                <IconButton
                  onClick={() => router.push('/kb')}
                  sx={{
                    color: theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                  title="Knowledge Base"
                >
                  <HelpIcon />
                </IconButton>
              )}
              <NotificationBell onOpenDrawer={() => setNotificationDrawerOpen(true)} />
              <Box sx={{ width: 8 }} /> {/* Spacer between bell and user icon */}
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  p: 0,
                  '&:hover': {
                    opacity: 0.8,
                  },
                }}
              >
                <Avatar
                  src={user?.avatar_url || undefined}
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: theme.palette.text.primary,
                    color: theme.palette.background.default,
                    border: `1px solid ${theme.palette.divider}`,
                    cursor: 'pointer',
                  }}
                >
                  {getUserInitials()}
                </Avatar>
              </IconButton>
            </>
          )}
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 200,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              '& .MuiMenuItem-root': {
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              },
            },
          }}
        >
          {user && (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {user.name || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {user.email}
              </Typography>
            </Box>
          )}
          <Divider sx={{ borderColor: theme.palette.divider }} />
          <MenuItem
            onClick={() => handleNavigate('/dashboard')}
            sx={{
              color: `${theme.palette.text.primary} !important`,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: `${theme.palette.text.primary} !important`,
              },
              '&:focus': {
                backgroundColor: 'transparent',
                color: `${theme.palette.text.primary} !important`,
              },
            }}
          >
            <DashboardIcon fontSize="small" sx={{ mr: isDesktop ? 1.5 : 0, color: theme.palette.text.primary }} />
            {isDesktop && <Box component="span" sx={{ color: theme.palette.text.primary, fontSize: '0.875rem' }}>Dashboard</Box>}
          </MenuItem>
          {!roleLoading && isSuperAdmin && (
            <MenuItem
              onClick={() => handleNavigate('/global/admin')}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <SecurityIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.text.primary }} />
              <Typography sx={{ color: theme.palette.text.primary }}>Super Admin</Typography>
            </MenuItem>
          )}
          {!roleLoading && role === 'admin' && (
            <MenuItem
              onClick={() => handleNavigate('/admin')}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <AdminIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.text.primary }} />
              <Typography sx={{ color: theme.palette.text.primary }}>Admin</Typography>
            </MenuItem>
          )}
          <MenuItem
            onClick={() => handleNavigate('/profile')}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <PersonIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.text.primary }} />
            <Typography sx={{ color: theme.palette.text.primary }}>Profile</Typography>
          </MenuItem>
          <Divider sx={{ borderColor: theme.palette.divider }} />
          <MenuItem
            onClick={handleSignOut}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <LogoutIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.text.primary }} />
            <Typography sx={{ color: theme.palette.text.primary }}>Sign Out</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
      <NotificationDrawer
        open={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
      <WelcomeTour
        open={welcomeTourOpen}
        onClose={() => setWelcomeTourOpen(false)}
        onComplete={() => setWelcomeTourOpen(false)}
      />
      <RequestSubmissionDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
      />
    </AppBar>
  );
}

