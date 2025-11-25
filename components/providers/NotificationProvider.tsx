'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

/**
 * Context type for notification functions
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
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

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

  return (
    <NotificationContext.Provider value={{ showNotification, showSuccess, showError, showWarning, showInfo }}>
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

