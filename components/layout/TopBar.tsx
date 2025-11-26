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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import NotificationBell from '@/components/notifications/NotificationBell';
import NotificationDrawer from '@/components/notifications/NotificationDrawer';
import type { User } from '@/types/project';

interface TopBarProps {
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function TopBar({ onSidebarToggle, sidebarOpen }: TopBarProps) {
  const router = useRouter();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();

      if (!error && data) {
        setUser(data as User);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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

  const handleSignOut = async () => {
    handleMenuClose();
    await supabase.auth.signOut();
    router.push('/auth/signin');
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
      <Toolbar sx={{ justifyContent: 'flex-end', minHeight: '64px !important', gap: 2 }}>
        {/* Scrolling Todo Bar - takes up center/left space */}

        {/* Right side icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!loading && (
            <>
              <NotificationBell onOpenDrawer={() => setNotificationDrawerOpen(true)} />
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
          {!roleLoading && role === 'admin' && (
            <MenuItem
              onClick={() => handleNavigate('/admin')}
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <AdminIcon fontSize="small" sx={{ mr: 1.5 }} />
              Admin
            </MenuItem>
          )}
          <MenuItem
            onClick={() => handleNavigate('/profile')}
            sx={{
              color: 'text.primary',
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <PersonIcon fontSize="small" sx={{ mr: 1.5 }} />
            Profile
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
            <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
            Sign Out
          </MenuItem>
        </Menu>
      </Toolbar>
      <NotificationDrawer
        open={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
    </AppBar>
  );
}

