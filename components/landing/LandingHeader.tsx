'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Divider,
  IconButton,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Person as PersonIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import type { User } from '@/types/project';

export default function LandingHeader() {
  const router = useRouter();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { role, isSuperAdmin, loading: roleLoading } = useRole();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUser, supabase]);

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
      elevation={0}
      sx={{
        backgroundColor: alpha(theme.palette.background.default, 0.8),
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          minHeight: '64px !important',
          px: { xs: 2, md: 4 },
        }}
      >
        {/* Logo/Branding */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => router.push('/')}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            FSM™
          </Typography>
        </Box>

        {/* Right side - Sign In or User Menu */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!loading && !user && (
            <Button
              variant="outlined"
              onClick={() => router.push('/auth/signin')}
              sx={{
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Sign In
            </Button>
          )}

          {!loading && user && (
            <>
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
                    bgcolor: theme.palette.primary.main,
                    color: theme.palette.background.default,
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    cursor: 'pointer',
                  }}
                >
                  {getUserInitials()}
                </Avatar>
              </IconButton>

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
                    boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
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
                {!roleLoading && isSuperAdmin && (
                  <MenuItem
                    onClick={() => handleNavigate('/global/admin')}
                    sx={{
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <SecurityIcon fontSize="small" sx={{ mr: 1.5 }} />
                    Super Admin
                  </MenuItem>
                )}
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
                  onClick={() => handleNavigate('/dashboard')}
                  sx={{
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <DashboardIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Dashboard
                </MenuItem>
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
                    color: theme.palette.error.main,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Sign Out
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

