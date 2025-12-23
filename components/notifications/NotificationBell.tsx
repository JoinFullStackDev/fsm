'use client';

import { useState } from 'react';
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { Notification } from '@/types/project';
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  onOpenDrawer: () => void;
}

export default function NotificationBell({ onOpenDrawer }: NotificationBellProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { notifications, unreadCount, loading, markAsRead } = useNotification();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Get only unread notifications for the dropdown (limit to 10)
  const unreadNotifications = notifications.filter(n => !n.read).slice(0, 10);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
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
          horizontal: isMobile ? 'center' : 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: isMobile ? 'center' : 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            width: isMobile ? 'calc(100vw - 32px)' : 'auto',
            minWidth: isMobile ? 'unset' : 320,
            maxWidth: isMobile ? 'calc(100vw - 32px)' : 400,
            maxHeight: 500,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'auto',
            ...(isMobile && {
              left: '16px !important',
              right: '16px !important',
            }),
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
        ) : unreadNotifications.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No new notifications
            </Typography>
          </Box>
        ) : (
          <>
            {unreadNotifications.map((notification) => (
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

