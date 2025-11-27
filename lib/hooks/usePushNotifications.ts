'use client';

import { useState, useEffect, useCallback } from 'react';
import logger from '@/lib/utils/logger';

export interface PushNotificationState {
  supported: boolean;
  subscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
  error: string | null;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Custom hook for managing browser push notifications
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    supported: false,
    subscribed: false,
    permission: 'default',
    loading: true,
    error: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      const permission = supported ? Notification.permission : 'denied';

      setState((prev) => ({
        ...prev,
        supported,
        permission,
        loading: false,
      }));
    };

    checkSupport();
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!state.supported || !VAPID_PUBLIC_KEY) {
      setState((prev) => ({ ...prev, subscribed: false, loading: false }));
      return;
    }

    try {
      // Get or register service worker
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        // Try to register if not already registered
        registration = await navigator.serviceWorker.register('/sw.js');
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
      }
      
      const subscription = await registration.pushManager.getSubscription();

      setState((prev) => ({
        ...prev,
        subscribed: !!subscription,
        loading: false,
      }));
    } catch (error) {
      logger.error('[usePushNotifications] Error checking subscription:', error);
      setState((prev) => ({
        ...prev,
        subscribed: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check subscription status',
      }));
    }
  }, [state.supported]);

  useEffect(() => {
    if (state.supported) {
      checkSubscription();
    }
  }, [state.supported, checkSubscription]);

  // Request permission and subscribe
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.supported) {
      setState((prev) => ({
        ...prev,
        error: 'Push notifications are not supported in this browser',
      }));
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      setState((prev) => ({
        ...prev,
        error: 'Push notifications are not configured',
      }));
      return false;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Request notification permission
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        setState((prev) => ({
          ...prev,
          permission,
          loading: false,
          error: 'Notification permission denied',
        }));
        return false;
      }

      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready;
        } catch (swError) {
          logger.error('[usePushNotifications] Service worker registration error:', swError);
          throw new Error(`Failed to register service worker: ${swError instanceof Error ? swError.message : 'Unknown error'}`);
        }
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!),
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
      }

      setState((prev) => ({
        ...prev,
        subscribed: true,
        permission,
        loading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      logger.error('[usePushNotifications] Error subscribing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.supported]);

  // Unsubscribe
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.supported) {
      return false;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });
      }

      setState((prev) => ({
        ...prev,
        subscribed: false,
        loading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      logger.error('[usePushNotifications] Error unsubscribing:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  }, [state.supported]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}

/**
 * Convert VAPID public key from base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

