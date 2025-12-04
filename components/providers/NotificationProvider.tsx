'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useUser } from '@/components/providers/UserProvider';
import type { Notification } from '@/types/project';

/**
 * Context type for notification functions and in-app notifications
 */
interface NotificationContextType {
  /** Show a notification with custom severity */
  showNotification: (message: string, severity?: AlertColor) => void;
  /** Show a success notification */
  showSuccess: (message: string) => void;
  /** Show an error notification */
  showError: (message: string) => void;
  /** Show a warning notification */
  showWarning: (message: string) => void;
  /** Show an info notification */
  showInfo: (message: string) => void;
  /** In-app notifications list */
  notifications: Notification[];
  /** Unread notifications count */
  unreadCount: number;
  /** Loading state for notifications */
  loading: boolean;
  /** Mark a notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a notification */
  deleteNotification: (id: string) => Promise<void>;
  /** Refresh notifications from server */
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Notification Provider Component
 * 
 * Provides a context for displaying toast notifications throughout the application.
 * Notifications appear as snackbars in the bottom-right corner and auto-dismiss after 6 seconds.
 * 
 * @param children - Child components that can use the notification context
 * 
 * @example
 * ```tsx
 * <NotificationProvider>
 *   <App />
 * </NotificationProvider>
 * ```
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Toast/Snackbar state
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  // In-app notifications state
  const { user } = useUser();
  const supabase = createSupabaseClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);
  const loadingRef = useRef(false);

  // Toast/Snackbar methods
  const showNotification = useCallback((msg: string, sev: AlertColor = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const showSuccess = useCallback((msg: string) => showNotification(msg, 'success'), [showNotification]);
  const showError = useCallback((msg: string) => showNotification(msg, 'error'), [showNotification]);
  const showWarning = useCallback((msg: string) => showNotification(msg, 'warning'), [showNotification]);
  const showInfo = useCallback((msg: string) => showNotification(msg, 'info'), [showNotification]);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  // In-app notifications: Fetch from server
  const fetchNotifications = useCallback(async () => {
    if (!user?.id || loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      const response = await fetch(`/api/notifications?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('[NotificationProvider] Error fetching notifications:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.id]);

  // In-app notifications: Refresh (public method)
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // In-app notifications: Mark as read
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    } catch (error) {
      // Revert on error
      await fetchNotifications();
    }
  }, [fetchNotifications]);

  // In-app notifications: Mark all as read
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await Promise.all(unreadIds.map(id => 
        fetch(`/api/notifications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        })
      ));
    } catch (error) {
      // Revert on error
      await fetchNotifications();
    }
  }, [notifications, fetchNotifications]);

  // In-app notifications: Delete
  const deleteNotification = useCallback(async (id: string) => {
    // Optimistic update
    const notif = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notif && !notif.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch (error) {
      // Revert on error
      await fetchNotifications();
    }
  }, [notifications, fetchNotifications]);

  // Initial fetch when user is available
  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [user?.id, fetchNotifications]);

  // Realtime subscription: Single instance per user
  useEffect(() => {
    if (!user?.id) {
      // Clean up subscription if user logs out
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      return;
    }

    // Clean up existing subscription before creating new one
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    const channelName = `notifications:${user.id}`;
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification;
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
            // Recalculate unread count
            if (updated.read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications(prev => {
              const deletedNotif = prev.find(n => n.id === deletedId);
              if (deletedNotif && !deletedNotif.read) {
                setUnreadCount(count => Math.max(0, count - 1));
              }
              return prev.filter(n => n.id !== deletedId);
            });
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[NotificationProvider] Realtime subscription error');
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, supabase]);

  const value = {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{
          '& .MuiSnackbarContent': {
            backgroundColor: severity === 'success' ? 'success.main' : 
                           severity === 'error' ? 'error.main' :
                           severity === 'warning' ? 'warning.main' : 'info.main',
          },
        }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          sx={{
            width: '100%',
            backgroundColor: severity === 'success' ? 'success.main' : 
                           severity === 'error' ? 'error.main' :
                           severity === 'warning' ? 'warning.main' : 'info.main',
            color: severity === 'success' ? 'success.contrastText' : 
                   severity === 'error' ? 'error.contrastText' :
                   severity === 'warning' ? 'warning.contrastText' : 'info.contrastText',
            fontWeight: 600,
            '& .MuiAlert-icon': {
              color: severity === 'success' ? 'success.contrastText' : 
                     severity === 'error' ? 'error.contrastText' :
                     severity === 'warning' ? 'warning.contrastText' : 'info.contrastText',
            },
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification functions
 * 
 * Must be used within a NotificationProvider component.
 * 
 * @returns Object with notification display functions
 * @throws Error if used outside NotificationProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { showSuccess, showError } = useNotification();
 *   
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       showSuccess('Data saved successfully!');
 *     } catch (error) {
 *       showError('Failed to save data');
 *     }
 *   };
 * }
 * ```
 */
export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

