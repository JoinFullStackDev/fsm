'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import logger from '@/lib/utils/logger';
import type { Notification } from '@/types/project';
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  onOpenDrawer: () => void;
}

export default function NotificationBell({ onOpenDrawer }: NotificationBellProps) {
  const router = useRouter();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('[NotificationBell] No session found');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) {
        logger.debug('[NotificationBell] No user data found');
        return;
      }

      // Fetch recent notifications
      const response = await fetch(`/api/notifications?limit=10&read=false`);
      if (!response.ok) {
        logger.error('[NotificationBell] Failed to fetch notifications:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      logger.debug('[NotificationBell] Loaded notifications:', {
        count: data.notifications?.length || 0,
        unreadCount: data.unreadCount || 0,
      });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      logger.error('[NotificationBell] Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const setupRealtimeSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) return;

      // Subscribe to notifications table changes
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userData.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              // New notification
              const newNotification = payload.new as Notification;
              setNotifications((prev) => [newNotification, ...prev].slice(0, 10));
              setUnreadCount((prev) => prev + 1);
            } else if (payload.eventType === 'UPDATE') {
              // Notification updated (e.g., marked as read)
              const updatedNotification = payload.new as Notification;
              setNotifications((prev) =>
                prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
              );
              if (updatedNotification.read) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              } else {
                setUnreadCount((prev) => prev + 1);
              }
            }
          }
        )
        .subscribe();

      subscriptionRef.current = channel;
    } catch (error) {
      logger.error('[NotificationBell] Error setting up subscription:', error);
    }
  }, [supabase]);

  useEffect(() => {
    loadNotifications();
    setupRealtimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [loadNotifications, setupRealtimeSubscription]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        logger.error('[NotificationBell] Error marking as read:', error);
      }
    }

    // Navigate based on notification type
    if (notification.metadata.project_id) {
      if (notification.metadata.task_id) {
        // Navigate to project management page with task ID query parameter
        router.push(`/project-management/${notification.metadata.project_id}?taskId=${notification.metadata.task_id}`);
      } else {
        router.push(`/project/${notification.metadata.project_id}`);
      }
    }

    handleMenuClose();
  };

  const handleViewAll = () => {
    handleMenuClose();
    onOpenDrawer();
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <>
      <IconButton
        onClick={handleMenuOpen}
        sx={{
          color: theme.palette.text.primary,
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
          },
        }}
      >
        <Badge 
          badgeContent={unreadCount} 
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
            },
          }}
        >
          {unreadCount > 0 ? (
            <NotificationsIcon sx={{ color: theme.palette.text.primary }} />
          ) : (
            <NotificationsNoneIcon sx={{ color: theme.palette.text.primary }} />
          )}
        </Badge>
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
            minWidth: 320,
            maxWidth: 400,
            maxHeight: 500,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'auto',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Notifications
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No new notifications
            </Typography>
          </Box>
        ) : (
          <>
            {notifications.map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  py: 1.5,
                  px: 2,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  backgroundColor: notification.read
                    ? 'transparent'
                    : theme.palette.action.hover,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: notification.read ? 'text.secondary' : 'text.primary',
                      fontWeight: notification.read ? 400 : 600,
                      mb: 0.5,
                    }}
                  >
                    {notification.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {notification.message}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                  >
                    {formatTime(notification.created_at)}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </>
        )}

        <Divider sx={{ borderColor: theme.palette.divider }} />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            onClick={handleViewAll}
            sx={{
              color: theme.palette.text.primary,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            View All Notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
}

