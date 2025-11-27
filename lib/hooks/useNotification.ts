'use client';

/**
 * Notification hook wrapper
 * Provides a consistent import path for the notification hook
 */
import { useNotification as useNotificationFromProvider } from '@/components/providers/NotificationProvider';

export function useNotification() {
  return useNotificationFromProvider();
}
