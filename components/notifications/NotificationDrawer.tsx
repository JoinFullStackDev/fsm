'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Assignment as TaskIcon,
  Comment as CommentIcon,
  PersonAdd as PersonAddIcon,
  FolderOpen as ProjectIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { Notification } from '@/types/project';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from 'date-fns';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

type NotificationGroup = {
  label: string;
  notifications: Notification[];
};

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; notificationId: string } | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (open) {
      loadNotifications();
      setupRealtimeSubscription();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [open]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications?limit=100');
      if (!response.ok) {
        throw new Error('Failed to load notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('[NotificationDrawer] Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = async () => {
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
        .channel('notifications-drawer')
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
              setNotifications((prev) => [newNotification, ...prev]);
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
      console.error('[NotificationDrawer] Error setting up subscription:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[NotificationDrawer] Error marking as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <TaskIcon sx={{ fontSize: 20 }} />;
      case 'comment_created':
      case 'comment_mention':
        return <CommentIcon sx={{ fontSize: 20 }} />;
      case 'project_created':
        return <ProjectIcon sx={{ fontSize: 20 }} />;
      case 'project_member_added':
        return <PersonAddIcon sx={{ fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      setDeletingId(notificationId);
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notifications.find((n) => n.id === notificationId && !n.read)) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('[NotificationDrawer] Error deleting notification:', error);
    } finally {
      setDeletingId(null);
      setMenuAnchor(null);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, notificationId: string) => {
    event.stopPropagation();
    setMenuAnchor({ element: event.currentTarget, notificationId });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      const unreadNotifications = notifications.filter((n) => !n.read);
      
      await Promise.all(
        unreadNotifications.map((n) =>
          fetch(`/api/notifications/${n.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        )
      );

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[NotificationDrawer] Error marking all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.metadata.project_id) {
      if (notification.metadata.task_id) {
        // Navigate to project management page with task ID query parameter to open task detail sheet
        router.push(`/project-management/${notification.metadata.project_id}?taskId=${notification.metadata.task_id}`);
      } else {
        router.push(`/project/${notification.metadata.project_id}`);
      }
    }

    onClose();
  };

  const groupNotifications = (): NotificationGroup[] => {
    const groups: NotificationGroup[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const thisWeek: Notification[] = [];
    const older: Notification[] = [];

    notifications.forEach((notification) => {
      const date = new Date(notification.created_at);
      if (isToday(date)) {
        today.push(notification);
      } else if (isYesterday(date)) {
        yesterday.push(notification);
      } else if (isThisWeek(date)) {
        thisWeek.push(notification);
      } else {
        older.push(notification);
      }
    });

    if (today.length > 0) {
      groups.push({ label: 'Today', notifications: today });
    }
    if (yesterday.length > 0) {
      groups.push({ label: 'Yesterday', notifications: yesterday });
    }
    if (thisWeek.length > 0) {
      groups.push({ label: 'This Week', notifications: thisWeek });
    }
    if (older.length > 0) {
      groups.push({ label: 'Older', notifications: older });
    }

    return groups;
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isToday(date)) {
        return format(date, 'h:mm a');
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const groupedNotifications = groupNotifications();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '75%', md: '50%' },
          backgroundColor: '#121633',
          borderLeft: '1px solid rgba(0, 229, 255, 0.2)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#00E5FF',
                fontWeight: 600,
              }}
            >
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead}
                sx={{
                  color: '#00E5FF',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                }}
              >
                {markingAllRead ? <CircularProgress size={16} /> : 'Mark all read'}
              </Button>
            )}
            <IconButton onClick={onClose} sx={{ color: '#00E5FF' }} title="Close">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : notifications.length === 0 ? (
            <Alert severity="info" sx={{ backgroundColor: 'rgba(0, 229, 255, 0.1)' }}>
              No notifications yet
            </Alert>
          ) : (
            groupedNotifications.map((group) => (
              <Box key={group.label} sx={{ mb: 3 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: '#00E5FF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    mb: 1,
                    display: 'block',
                  }}
                >
                  {group.label}
                </Typography>
                <List sx={{ p: 0 }}>
                  {group.notifications.map((notification) => (
                    <ListItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      sx={{
                        mb: 1,
                        p: 2,
                        borderRadius: 1,
                        backgroundColor: notification.read
                          ? 'transparent'
                          : 'rgba(0, 229, 255, 0.05)',
                        border: notification.read
                          ? '1px solid rgba(0, 229, 255, 0.1)'
                          : '1px solid rgba(0, 229, 255, 0.2)',
                        cursor: 'pointer',
                        position: 'relative',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                          '& .notification-actions': {
                            opacity: 1,
                          },
                        },
                      }}
                    >
                      <Box sx={{ width: '100%', display: 'flex', gap: 1.5 }}>
                        <Box sx={{ mt: 0.5, color: 'primary.main' }}>
                          {getNotificationIcon(notification.type)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                color: notification.read ? 'text.secondary' : 'text.primary',
                                fontWeight: notification.read ? 400 : 600,
                                flex: 1,
                              }}
                            >
                              {notification.title}
                            </Typography>
                            <Box
                              className="notification-actions"
                              sx={{
                                display: 'flex',
                                gap: 0.5,
                                opacity: 0,
                                transition: 'opacity 0.2s',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {notification.read && (
                                <CheckCircleIcon
                                  sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}
                                />
                              )}
                              <Tooltip title="More options">
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMenuOpen(e, notification.id)}
                                  sx={{
                                    color: 'text.secondary',
                                    '&:hover': {
                                      backgroundColor: 'rgba(0, 229, 255, 0.1)',
                                    },
                                  }}
                                >
                                  <MoreVertIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.875rem',
                              mb: 0.5,
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
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* Notification Actions Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            backgroundColor: '#121633',
            border: '1px solid rgba(0, 229, 255, 0.2)',
          },
        }}
      >
        {menuAnchor && (
          <>
            <MenuItem
              onClick={() => {
                const notification = notifications.find((n) => n.id === menuAnchor.notificationId);
                if (notification && !notification.read) {
                  handleMarkAsRead(menuAnchor.notificationId);
                }
                handleMenuClose();
              }}
              sx={{ color: 'text.primary' }}
            >
              Mark as read
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (menuAnchor) {
                  handleDelete(menuAnchor.notificationId);
                }
              }}
              disabled={deletingId === menuAnchor?.notificationId}
              sx={{ color: 'error.main' }}
            >
              {deletingId === menuAnchor?.notificationId ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Deleting...
                </>
              ) : (
                <>
                  <DeleteIcon sx={{ fontSize: 18, mr: 1 }} />
                  Delete
                </>
              )}
            </MenuItem>
          </>
        )}
      </Menu>
    </Drawer>
  );
}

